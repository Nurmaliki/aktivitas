import { browser } from '$app/environment';
import { DEFAULT_SETTINGS, type AppSettings, type StepRecord, type StepSource } from '$lib/types/steps';
import { MAX_STEPS_PER_DAY } from '$lib/types/steps';
import * as db from '$lib/services/db';
import { DatabaseError } from '$lib/services/db';
import { getLocalDateString } from '$lib/utils/date';
import { computeStepStats } from '$lib/utils/stepStatistics';

/**
 * Store for the step counter. Mirrors `activityStore`'s shape: load once into
 * memory, then keep IndexedDB and the UI in sync on every mutation.
 */
class StepStore {
	records = $state<StepRecord[]>([]);
	settings = $state<AppSettings>({ ...DEFAULT_SETTINGS });
	loading = $state(false);
	saving = $state(false);
	error = $state<string | null>(null);
	initialized = $state(false);

	private loadPromise: Promise<void> | null = null;
	/** Serializes read-modify-write mutations so concurrent increments don't lose data. */
	private mutationChain: Promise<unknown> = Promise.resolve();

	private sort(list: StepRecord[]): StepRecord[] {
		return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	}

	clearError(): void {
		this.error = null;
	}

	private setError(error: unknown, fallback: string): void {
		this.error =
			error instanceof DatabaseError
				? error.message
				: error instanceof Error && error.message
					? error.message
					: fallback;
	}

	/** Load step records and settings once. Safe to call from many components. */
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
				const [records, settings] = await Promise.all([
					db.getStepRecords(),
					db.getSettings()
				]);
				this.records = this.sort(records);
				this.settings = settings;
			} catch (error) {
				this.setError(error, 'Gagal memuat data langkah.');
			} finally {
				this.loading = false;
				this.initialized = true;
			}
		})();

		return this.loadPromise;
	}

	async refresh(): Promise<void> {
		this.loadPromise = null;
		await this.init(true);
	}

	/** The configured daily goal (falls back to the default). */
	get goal(): number {
		return this.settings.stepGoal > 0 ? this.settings.stepGoal : DEFAULT_SETTINGS.stepGoal;
	}

	/** Steps recorded for a specific local date. */
	stepsFor(date: string): number {
		return this.records.find((record) => record.date === date)?.steps ?? 0;
	}

	/** Steps recorded today (local timezone). */
	get todaySteps(): number {
		return this.stepsFor(getLocalDateString());
	}

	/** Aggregate stats across all recorded days. */
	get stats() {
		return computeStepStats(this.records);
	}

	/**
	 * Set the step total for a date (upsert).
	 * `steps` is clamped to a sane range; `source` records provenance.
	 */
	async setSteps(date: string, steps: number, source: StepSource = 'manual'): Promise<boolean> {
		if (!db.isIndexedDBAvailable()) {
			this.setError(null, 'Penyimpanan browser tidak tersedia.');
			return false;
		}
		const safeSteps = Number.isFinite(steps)
			? Math.max(0, Math.min(MAX_STEPS_PER_DAY, Math.round(steps)))
			: 0;

		this.saving = true;
		this.error = null;
		try {
			const record: StepRecord = {
				date,
				steps: safeSteps,
				source,
				updatedAt: new Date().toISOString()
			};
			const saved = await db.putStepRecord(record);
			this.records = this.sort([
				...this.records.filter((item) => item.date !== date),
				saved
			]);
			return true;
		} catch (error) {
			this.setError(error, 'Gagal menyimpan data langkah.');
			return false;
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Add steps to a date (never below 0).
	 *
	 * Runs through a serialization chain so two concurrent increments (e.g. a
	 * sensor tick and a manual entry) cannot both read the same starting value
	 * and clobber each other's write.
	 */
	async addSteps(date: string, delta: number, source: StepSource = 'sensor'): Promise<boolean> {
		const run = this.mutationChain.then(async () => {
			const current = this.stepsFor(date);
			const next = Math.max(0, Math.min(MAX_STEPS_PER_DAY, current + Math.round(delta)));
			return this.setSteps(date, next, source);
		});
		// Keep the chain alive even if this link rejects.
		this.mutationChain = run.catch(() => undefined);
		return run;
	}

	async remove(date: string): Promise<void> {
		this.saving = true;
		this.error = null;
		try {
			await db.deleteStepRecord(date);
			this.records = this.records.filter((record) => record.date !== date);
		} catch (error) {
			this.setError(error, 'Gagal menghapus data langkah.');
		} finally {
			this.saving = false;
		}
	}

	async updateGoal(goal: number): Promise<boolean> {
		const next = { ...this.settings, stepGoal: db.clampStepGoal(goal) };
		this.saving = true;
		this.error = null;
		try {
			this.settings = await db.putSettings(next);
			return true;
		} catch (error) {
			this.setError(error, 'Gagal menyimpan target langkah.');
			return false;
		} finally {
			this.saving = false;
		}
	}

	/** Replace all step data (used by the "Replace" import). */
	async runImport(records: StepRecord[], mode: 'merge' | 'replace'): Promise<DatabaseError | null> {
		const plain = $state.snapshot(records) as StepRecord[];
		this.saving = true;
		this.error = null;
		try {
			if (mode === 'replace') {
				await db.replaceStepRecords(plain);
			} else {
				await db.mergeStepRecords(plain);
			}
			await this.refresh();
			return null;
		} catch (error) {
			this.setError(error, 'Gagal mengimpor data langkah.');
			return error instanceof DatabaseError ? error : null;
		} finally {
			this.saving = false;
		}
	}
}

export const stepStore = new StepStore();
