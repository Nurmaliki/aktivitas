import { browser } from '$app/environment';
import type { Habit, HabitInput, HabitLog } from '$lib/types/habit';
import * as repo from '$lib/repositories/habitRepository';
import { getLocalDateString } from '$lib/utils/date';
import { indexLogs, summarize } from '$lib/utils/habits';

/**
 * Habit + habit-log store built on Svelte 5 runes.
 *
 * Reads every habit and log once, then derives streaks/completion in memory.
 */
class HabitStore {
	habits = $state<Habit[]>([]);
	logs = $state<HabitLog[]>([]);
	loading = $state(false);
	saving = $state(false);
	error = $state<string | null>(null);
	initialized = $state(false);

	private loadPromise: Promise<void> | null = null;

	private sort(list: Habit[]): Habit[] {
		return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	}

	clearError(): void {
		this.error = null;
	}

	private setError(error: unknown, fallback: string): void {
		this.error = error instanceof Error && error.message ? error.message : fallback;
	}

	async init(force = false): Promise<void> {
		if (!browser || typeof indexedDB === 'undefined') {
			this.initialized = true;
			return;
		}
		if (this.loadPromise && !force) return this.loadPromise;
		this.loading = true;
		this.loadPromise = (async () => {
			try {
				const [habits, logs] = await Promise.all([repo.getHabits(), repo.getHabitLogs()]);
				this.habits = this.sort(habits);
				this.logs = logs;
			} catch (error) {
				this.setError(error, 'Gagal memuat kebiasaan.');
			} finally {
				this.loading = false;
				this.initialized = true;
			}
		})();
		return this.loadPromise;
	}

	async add(input: HabitInput): Promise<Habit | null> {
		this.saving = true;
		this.error = null;
		try {
			const created = await repo.addHabit($state.snapshot(input) as HabitInput);
			this.habits = this.sort([...this.habits, created]);
			return created;
		} catch (error) {
			this.setError(error, 'Gagal menyimpan kebiasaan.');
			return null;
		} finally {
			this.saving = false;
		}
	}

	async update(id: string, changes: Partial<HabitInput>): Promise<Habit | null> {
		this.saving = true;
		this.error = null;
		try {
			const updated = await repo.updateHabit(id, $state.snapshot(changes) as Partial<HabitInput>);
			this.habits = this.sort(this.habits.map((h) => (h.id === id ? updated : h)));
			return updated;
		} catch (error) {
			this.setError(error, 'Gagal memperbarui kebiasaan.');
			return null;
		} finally {
			this.saving = false;
		}
	}

	/** Archive (soft-delete) a habit. */
	async archive(id: string): Promise<void> {
		this.saving = true;
		this.error = null;
		try {
			await repo.deleteHabit(id);
			this.habits = this.habits.filter((h) => h.id !== id);
			this.logs = this.logs.filter((l) => l.habitId !== id);
		} catch (error) {
			this.setError(error, 'Gagal mengarsipkan kebiasaan.');
		} finally {
			this.saving = false;
		}
	}

	/** Toggle today's completion for a habit. */
	async toggleCompletion(habitId: string, date: string = getLocalDateString()): Promise<void> {
		this.saving = true;
		this.error = null;
		try {
			const existing = this.logs.find((l) => l.habitId === habitId && l.date === date);
			const next = !(existing?.completed ?? false);
			const saved = await repo.putHabitLog({
				id: existing?.id,
				habitId,
				date,
				completed: next,
				completedAt: next ? new Date().toISOString() : undefined
			});
			this.logs = [...this.logs.filter((l) => !(l.habitId === habitId && l.date === date)), saved];
		} catch (error) {
			this.setError(error, 'Gagal memperbarui kebiasaan.');
		} finally {
			this.saving = false;
		}
	}

	/** Explicitly set a log's completed flag for a date. */
	async setCompletion(habitId: string, date: string, completed: boolean): Promise<void> {
		this.saving = true;
		this.error = null;
		try {
			const existing = this.logs.find((l) => l.habitId === habitId && l.date === date);
			const saved = await repo.putHabitLog({
				id: existing?.id,
				habitId,
				date,
				completed,
				completedAt: completed ? new Date().toISOString() : undefined,
				value: existing?.value
			});
			this.logs = [...this.logs.filter((l) => !(l.habitId === habitId && l.date === date)), saved];
		} catch (error) {
			this.setError(error, 'Gagal memperbarui kebiasaan.');
		} finally {
			this.saving = false;
		}
	}

	logsFor(habitId: string): HabitLog[] {
		return this.logs.filter((l) => l.habitId === habitId);
	}

	isCompletedOn(habitId: string, date: string): boolean {
		return this.logs.some((l) => l.habitId === habitId && l.date === date && l.completed);
	}

	streakFor(habit: Habit) {
		return summarize(habit, this.logsFor(habit.id));
	}

	completionIndex(): Map<string, HabitLog> {
		return indexLogs(this.logs);
	}

	/** Active (non-archived) habits, optionally only those scheduled today. */
	activeHabits(scheduledOnly = false, date: string = getLocalDateString()): Habit[] {
		const active = this.habits.filter((h) => h.active && !h.deletedAt);
		if (!scheduledOnly) return active;
		return active;
	}
}

export const habitStore = new HabitStore();
