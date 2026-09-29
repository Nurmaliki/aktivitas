import type { Activity, ActivityInput } from '$lib/types/activity';
import {
	DEFAULT_SETTINGS,
	MAX_STEPS_PER_DAY,
	MIN_STEP_GOAL,
	MAX_STEP_GOAL,
	type AppSettings,
	type StepRecord,
	type StepSource
} from '$lib/types/steps';
import { isValidActivity } from '$lib/utils/validation';
import { normalizeActivities, normalizeActivity } from '$lib/utils/migration';
import type { Habit, HabitLog } from '$lib/types/habit';
import type { FocusSession } from '$lib/types/focus';
import { isValidHabit, isValidHabitLog, isValidFocusSession } from '$lib/utils/validators';
import {
	DB_NAME,
	DB_VERSION,
	STORES,
	DatabaseError,
	generateId,
	isIndexedDBAvailable,
	openDatabase,
	requestToPromise,
	waitForTransaction,
	withRawStore as withRawStoreShared,
	withMultiStore,
	withStore as withStoreShared,
	type StoreName
} from '$lib/repositories/db-core';

// Re-export the shared primitives so existing importers of `services/db` keep
// working. `repositories/db-core.ts` is now the single source of truth for the
// schema, the connection cache and the transaction helpers.
export { DB_NAME, DB_VERSION, DatabaseError, generateId, isIndexedDBAvailable, openDatabase };

export const STORE_NAME = STORES.activities;
export const STEPS_STORE = STORES.steps;
export const SETTINGS_STORE = STORES.settings;
export const HABITS_STORE = STORES.habits;
export const HABIT_LOGS_STORE = STORES.habitLogs;
export const FOCUS_STORE = STORES.focusSessions;
export const SYNC_QUEUE_STORE = STORES.syncQueue;
export const METADATA_STORE = STORES.metadata;

/** Clamp a step goal into the allowed range, falling back to the default. */
export function clampStepGoal(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_SETTINGS.stepGoal;
	return Math.min(MAX_STEP_GOAL, Math.max(MIN_STEP_GOAL, Math.round(value)));
}

const STEP_SOURCES: StepSource[] = ['sensor', 'manual', 'import'];

/** Type guard for a step record read from storage or an imported file. */
export function isValidStepRecord(value: unknown): value is StepRecord {
	if (typeof value !== 'object' || value === null) return false;
	const record = value as Record<string, unknown>;
	if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) return false;
	if (typeof record.steps !== 'number' || !Number.isFinite(record.steps)) return false;
	if (record.steps < 0 || record.steps > MAX_STEPS_PER_DAY) return false;
	if (typeof record.source !== 'string' || !STEP_SOURCES.includes(record.source as StepSource)) {
		return false;
	}
	if (typeof record.updatedAt !== 'string' || record.updatedAt.length === 0) return false;
	return true;
}

/**
 * Activity-scoped wrappers over the shared transaction helpers.
 *
 * The original `db.ts` defaulted the store name to `activities`; the shared
 * primitives in `repositories/db-core.ts` take it explicitly. These local
 * wrappers preserve the historical call sites without a default parameter.
 */
function withStore<T>(
	mode: IDBTransactionMode,
	handler: (store: IDBObjectStore) => Promise<T> | T,
	storeName: StoreName = STORES.activities
): Promise<T> {
	return withStoreShared(mode, handler, storeName);
}

function withRawStore<T>(
	mode: IDBTransactionMode,
	handler: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>,
	storeName: StoreName = STORES.activities
): Promise<T> {
	return withRawStoreShared(mode, handler, storeName);
}

/** Read every activity, normalizing (and filtering out malformed) records. */
export function getActivities(): Promise<Activity[]> {
	return withStore('readonly', async (store) => {
		const raw = await requestToPromise(store.getAll());
		return normalizeActivities(raw.filter(isValidActivity));
	});
}

/** Read a single activity by id. */
export function getActivity(id: string): Promise<Activity | undefined> {
	return withStore('readonly', async (store) => {
		const raw = await requestToPromise<unknown>(store.get(id));
		return isValidActivity(raw) ? normalizeActivity(raw) : undefined;
	});
}

/** Insert a new activity from a validated input and return the stored record. */
export function addActivity(input: ActivityInput): Promise<Activity> {
	const now = new Date().toISOString();
	const activity: Activity = {
		id: generateId(),
		name: input.name,
		description: input.description,
		category: input.category,
		date: input.date,
		duration: input.duration,
		completed: input.completed,
		createdAt: now,
		updatedAt: now
	};

	return withStore('readwrite', async (store) => {
		await requestToPromise(store.add(activity));
		return activity;
	});
}

/** Update an existing activity (merging with the stored record). */
export function updateActivity(
	id: string,
	changes: Partial<ActivityInput>
): Promise<Activity> {
	return withStore('readwrite', async (store) => {
		const raw = await requestToPromise<unknown>(store.get(id));
		if (!isValidActivity(raw)) {
			throw new DatabaseError('Aktivitas tidak ditemukan.');
		}
		const updated: Activity = {
			...raw,
			...changes,
			id: raw.id,
			createdAt: raw.createdAt,
			updatedAt: new Date().toISOString()
		};
		await requestToPromise(store.put(updated));
		return updated;
	});
}

/**
 * Patch arbitrary fields on a stored activity (bypasses ActivityInput typing).
 * Used for reminder/snooze/status updates that are not part of the create form.
 */
export function patchActivity(id: string, changes: Partial<Activity>): Promise<Activity> {
	return withStore('readwrite', async (store) => {
		const raw = await requestToPromise<unknown>(store.get(id));
		if (!isValidActivity(raw)) {
			throw new DatabaseError('Aktivitas tidak ditemukan.');
		}
		const merged: Activity = {
			...raw,
			...changes,
			id: raw.id,
			createdAt: raw.createdAt,
			updatedAt: new Date().toISOString()
		};
		const updated = normalizeActivity(merged);
		await requestToPromise(store.put(updated));
		return updated;
	});
}

/**
 * Force-write an activity, overwriting any existing record with the same id.
 * Used by the sync engine when a remote change wins the conflict resolution.
 */
export function upsertActivity(activity: Activity): Promise<void> {
	if (!isValidActivity(activity)) return Promise.resolve();
	const normalized = normalizeActivity(activity);
	return withStore('readwrite', async (store) => {
		await requestToPromise(store.put(normalized));
	});
}

/** Delete a single activity. */
export function deleteActivity(id: string): Promise<void> {
	return withStore('readwrite', async (store) => {
		await requestToPromise(store.delete(id));
	});
}

/** Remove every activity from the store. */
export function clearActivities(): Promise<void> {
	return withStore('readwrite', async (store) => {
		await requestToPromise(store.clear());
	});
}

/**
 * Replace all activities: clear the store, then insert every record.
 * All requests are issued synchronously within one transaction so it never
 * auto-commits mid-way.
 */
export function replaceActivities(activities: Activity[]): Promise<void> {
	return withRawStore('readwrite', (store, transaction) => {
		store.clear();
		for (const activity of activities) {
			store.put(activity);
		}
		return waitForTransaction(transaction);
	});
}

/**
 * Insert activities, skipping any whose id already exists (used by "Merge").
 * Returns how many records were actually added.
 *
 * The existence check and the inserts happen inside a single transaction.
 * All inserts are issued synchronously in the request's onsuccess callback so
 * the transaction stays alive.
 */
export function mergeActivities(activities: Activity[]): Promise<number> {
	return withRawStore('readwrite', (store, transaction) => {
		let added = 0;
		return new Promise<number>((resolve, reject) => {
			const keysRequest = store.getAllKeys();
			keysRequest.onsuccess = () => {
				const existing = new Set(keysRequest.result.map((key) => String(key)));
				for (const activity of activities) {
					if (existing.has(activity.id)) continue;
					store.put(activity);
					existing.add(activity.id);
					added += 1;
				}
				// Resolve after the transaction commits, so the caller sees the
				// fully-persisted state.
				transaction.oncomplete = () => resolve(added);
			};
			keysRequest.onerror = () => reject(new DatabaseError('Gagal membaca data aktivitas.', keysRequest.error));
		});
	});
}

// ---------------------------------------------------------------------------
// Step counter (v2)
// ---------------------------------------------------------------------------

/** Read every step record. */
export function getStepRecords(): Promise<StepRecord[]> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise(store.getAll());
			return raw.filter(isValidStepRecord);
		},
		STEPS_STORE
	);
}

/** Read a single day's step record. */
export function getStepRecord(date: string): Promise<StepRecord | undefined> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise(store.get(date));
			return isValidStepRecord(raw) ? raw : undefined;
		},
		STEPS_STORE
	);
}

/** Upsert a day's step total. */
export function putStepRecord(record: StepRecord): Promise<StepRecord> {
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.put(record));
			return record;
		},
		STEPS_STORE
	);
}

/** Delete a day's step record. */
export function deleteStepRecord(date: string): Promise<void> {
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.delete(date));
		},
		STEPS_STORE
	);
}

/** Remove all step records. */
export function clearStepRecords(): Promise<void> {
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.clear());
		},
		STEPS_STORE
	);
}

/** Replace all step records (used by the "Replace" import). */
export function replaceStepRecords(records: StepRecord[]): Promise<void> {
	return withRawStore(
		'readwrite',
		(store, transaction) => {
			store.clear();
			for (const record of records) store.put(record);
			return waitForTransaction(transaction);
		},
		STEPS_STORE
	);
}

/**
 * Merge step records. For a date already present, keep the higher step total
 * (a day's count should never go down when merging two sources).
 * Returns how many records were newly inserted.
 */
export function mergeStepRecords(records: StepRecord[]): Promise<number> {
	return withRawStore(
		'readwrite',
		(store, transaction) => {
			let added = 0;
			return new Promise<number>((resolve, reject) => {
				// A single getAll() keeps the transaction alive across one request
				// only (no cross-task chaining), avoiding a premature auto-commit.
				const allRequest = store.getAll();
				allRequest.onsuccess = () => {
					const byDate = new Map<string, StepRecord>();
					for (const value of allRequest.result as unknown[]) {
						if (isValidStepRecord(value)) byDate.set(value.date, value);
					}
					for (const record of records) {
						const existing = byDate.get(record.date);
						if (!existing) {
							store.put(record);
							byDate.set(record.date, record);
							added += 1;
						} else if (record.steps > existing.steps) {
							store.put(record);
							byDate.set(record.date, record);
						}
					}
					transaction.oncomplete = () => resolve(added);
				};
				allRequest.onerror = () =>
					reject(new DatabaseError('Gagal membaca data langkah.', allRequest.error));
			});
		},
		STEPS_STORE
	);
}

// ---------------------------------------------------------------------------
// Settings (v2)
// ---------------------------------------------------------------------------

interface SettingsRow {
	key: string;
	value: unknown;
}

/** Read the app settings (falls back to defaults for missing keys). */
export function getSettings(): Promise<AppSettings> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = (await requestToPromise(store.getAll())) as unknown[];
			const settings: AppSettings = { ...DEFAULT_SETTINGS };
			for (const row of raw) {
				if (typeof row !== 'object' || row === null) continue;
				const { key, value } = row as SettingsRow;
				if (key === 'stepGoal' && typeof value === 'number' && Number.isFinite(value)) {
					settings.stepGoal = clampStepGoal(value);
				}
			}
			return settings;
		},
		SETTINGS_STORE
	);
}

/** Persist the app settings. */
export function putSettings(settings: AppSettings): Promise<AppSettings> {
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.put({ key: 'stepGoal', value: settings.stepGoal }));
			return settings;
		},
		SETTINGS_STORE
	);
}

// ---------------------------------------------------------------------------
// Atomic whole-database import (v3)
// ---------------------------------------------------------------------------

export interface ReplaceDataPayload {
	activities: Activity[];
	steps: StepRecord[];
	settings?: AppSettings;
	habits: Habit[];
	habitLogs: HabitLog[];
	focusSessions: FocusSession[];
}

/**
 * Replace *all* data across every store in a single IndexedDB transaction.
 *
 * Unlike calling `replaceActivities` + `replaceStepRecords` + … in sequence
 * (which commits store-by-store and can leave a half-wiped database if one step
 * throws), this is atomic: if any write fails the whole transaction aborts and
 * IndexedDB rolls back to the previous state.
 */
export function replaceAllData(payload: ReplaceDataPayload): Promise<void> {
	const stores = [
		STORES.activities,
		STORES.steps,
		STORES.settings,
		STORES.habits,
		STORES.habitLogs,
		STORES.focusSessions
	];
	return withMultiStore('readwrite', stores, async (tx) => {
		const activities = tx.objectStore(STORES.activities);
		const steps = tx.objectStore(STORES.steps);
		const settings = tx.objectStore(STORES.settings);
		const habits = tx.objectStore(STORES.habits);
		const habitLogs = tx.objectStore(STORES.habitLogs);
		const focus = tx.objectStore(STORES.focusSessions);

		// Issue every request synchronously in one task so the transaction does
		// not auto-commit between calls.
		activities.clear();
		for (const activity of payload.activities) activities.put(activity);

		steps.clear();
		for (const record of payload.steps) steps.put(record);

		settings.clear();
		if (payload.settings) {
			settings.put({ key: 'stepGoal', value: clampStepGoal(payload.settings.stepGoal) });
		}

		habits.clear();
		for (const habit of payload.habits) habits.put(habit);

		habitLogs.clear();
		for (const log of payload.habitLogs) habitLogs.put(log);

		focus.clear();
		for (const session of payload.focusSessions) focus.put(session);
	});
}
