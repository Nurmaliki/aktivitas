import { browser } from '$app/environment';
import type { Activity, ActivityInput } from '$lib/types/activity';
import * as db from '$lib/services/db';
import { DatabaseError } from '$lib/services/db';

/**
 * Central activity store built on Svelte 5 runes.
 *
 * The IndexedDB table is read exactly once on init; afterwards every component
 * reads from this in-memory state and the derived statistics. Mutations write
 * through to IndexedDB and update the in-memory list, so the UI never reloads.
 */
class ActivityStore {
	/** All activities currently held in memory. */
	activities = $state<Activity[]>([]);
	/** True until the initial load from IndexedDB settles. */
	loading = $state(false);
	/** True while a write/delete operation is in flight. */
	saving = $state(false);
	/** True while an import is running. */
	importing = $state(false);
	/** Last error message shown to the user, or null. */
	error = $state<string | null>(null);
	/** True once we attempted an initial load (success or failure). */
	initialized = $state(false);

	private loadPromise: Promise<void> | null = null;
	/** Serializes reminder patches so concurrent writes can't clobber each other. */
	private reminderChain: Promise<unknown> = Promise.resolve();

	/** Sort newest date first, then newest createdAt. */
	private sort(list: Activity[]): Activity[] {
		return [...list].sort((a, b) => {
			if (a.date !== b.date) return a.date < b.date ? 1 : -1;
			return a.createdAt < b.createdAt ? 1 : -1;
		});
	}

	/** Clear any previously displayed error. */
	clearError(): void {
		this.error = null;
	}

	private setError(error: unknown, fallback: string): void {
		const message =
			error instanceof DatabaseError
				? error.message
				: error instanceof Error && error.message
					? error.message
					: fallback;
		this.error = message;
	}

	/**
	 * Load activities from IndexedDB once.
	 * Safe to call from multiple components: subsequent calls reuse the promise.
	 * No-ops during SSR where IndexedDB is unavailable.
	 */
	async init(force = false): Promise<void> {
		if (!browser || !db.isIndexedDBAvailable()) {
			this.initialized = true;
			return;
		}
		if (this.loadPromise && !force) return this.loadPromise;

		this.loading = true;
		this.error = null;
		this.loadPromise = (async () => {
			try {
				const activities = await db.getActivities();
				this.activities = this.sort(activities);
			} catch (error) {
				this.setError(error, 'Gagal memuat aktivitas dari penyimpanan browser.');
			} finally {
				this.loading = false;
				this.initialized = true;
			}
		})();

		return this.loadPromise;
	}

	/** Re-read everything from IndexedDB. */
	async refresh(): Promise<void> {
		this.loadPromise = null;
		await this.init(true);
	}

	/** Insert a new activity. */
	async add(input: ActivityInput): Promise<Activity | null> {
		this.saving = true;
		this.error = null;
		try {
			const created = await db.addActivity($state.snapshot(input) as ActivityInput);
			this.activities = this.sort([...this.activities, created]);
			return created;
		} catch (error) {
			this.setError(error, 'Gagal menyimpan aktivitas.');
			return null;
		} finally {
			this.saving = false;
		}
	}

	/** Update an existing activity by id. */
	async update(id: string, changes: Partial<ActivityInput>): Promise<Activity | null> {
		this.saving = true;
		this.error = null;
		try {
			const updated = await db.updateActivity(id, $state.snapshot(changes) as Partial<ActivityInput>);
			this.activities = this.sort(
				this.activities.map((activity) => (activity.id === id ? updated : activity))
			);
			return updated;
		} catch (error) {
			this.setError(error, 'Gagal memperbarui aktivitas.');
			return null;
		} finally {
			this.saving = false;
		}
	}

	/** Flip the completed flag of an activity. */
	async toggle(id: string): Promise<void> {
		const current = this.activities.find((activity) => activity.id === id);
		if (!current) return;
		this.saving = true;
		this.error = null;
		try {
			const updated = await db.updateActivity(id, { completed: !current.completed });
			this.activities = this.sort(
				this.activities.map((activity) => (activity.id === id ? updated : activity))
			);
		} catch (error) {
			this.setError(error, 'Gagal mengubah status aktivitas.');
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Patch non-`ActivityInput` fields (reminder, snoozedUntil, status, etc.)
	 * directly on a stored activity. Used by the reminder/alarm engine.
	 *
	 * Patches are serialized so two rapid updates to the same activity (e.g. a
	 * snooze immediately followed by a status change) can't last-write-wins
	 * against each other.
	 */
	async setReminder(id: string, changes: Partial<Activity>): Promise<void> {
		const run = this.reminderChain.then(async () => {
			this.error = null;
			try {
				const updated = await db.patchActivity(id, $state.snapshot(changes) as Partial<Activity>);
				this.activities = this.sort(
					this.activities.map((activity) => (activity.id === id ? updated : activity))
				);
			} catch (error) {
				this.setError(error, 'Gagal memperbarui pengingat.');
			}
		});
		this.reminderChain = run.catch(() => undefined);
		return run;
	}

	/** Replace the checklist of an activity (used by the inline list UI). */
	async updateSubtasks(
		id: string,
		subtasks: import('$lib/types/common').Subtask[]
	): Promise<void> {
		this.saving = true;
		this.error = null;
		try {
			const updated = await db.updateActivity(id, {
				subtasks: $state.snapshot(subtasks)
			} as Partial<ActivityInput>);
			this.activities = this.sort(
				this.activities.map((activity) => (activity.id === id ? updated : activity))
			);
		} catch (error) {
			this.setError(error, 'Gagal memperbarui checklist.');
		} finally {
			this.saving = false;
		}
	}

	/** Delete an activity by id. */
	async remove(id: string): Promise<void> {
		this.saving = true;
		this.error = null;
		try {
			await db.deleteActivity(id);
			this.activities = this.activities.filter((activity) => activity.id !== id);
		} catch (error) {
			this.setError(error, 'Gagal menghapus aktivitas.');
		} finally {
			this.saving = false;
		}
	}

	/** Run an import and refresh in-memory state from the result. */
	async runImport(
		activities: Activity[],
		mode: 'merge' | 'replace'
	): Promise<db.DatabaseError | null> {
		this.importing = true;
		this.error = null;
		// `activities` may be a Svelte 5 reactive proxy (e.g. from a `$state`),
		// which structured clone cannot serialise into IndexedDB. Take a plain
		// snapshot first.
		const plain = $state.snapshot(activities) as Activity[];
		try {
			if (mode === 'replace') {
				await db.replaceActivities(plain);
				this.activities = this.sort(plain);
			} else {
				await db.mergeActivities(plain);
				await this.refresh();
			}
			return null;
		} catch (error) {
			this.setError(error, 'Gagal mengimpor data.');
			return error instanceof DatabaseError ? error : null;
		} finally {
			this.importing = false;
		}
	}

	/** Count of activities for a specific local date. */
	byDate(date: string): Activity[] {
		return this.activities.filter((activity) => activity.date === date);
	}
}

export const activityStore = new ActivityStore();
