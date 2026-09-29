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

export const DB_NAME = 'daily-activity-db';
export const DB_VERSION = 3;
export const STORE_NAME = 'activities';
export const STEPS_STORE = 'steps';
export const SETTINGS_STORE = 'settings';
export const HABITS_STORE = 'habits';
export const HABIT_LOGS_STORE = 'habitLogs';
export const FOCUS_STORE = 'focusSessions';
export const SYNC_QUEUE_STORE = 'syncQueue';
export const METADATA_STORE = 'metadata';

/** Custom error so callers can show friendly, human-readable messages. */
export class DatabaseError extends Error {
	constructor(message: string, public readonly cause?: unknown) {
		super(message);
		this.name = 'DatabaseError';
	}
}

/** True when running in a real browser with IndexedDB available. */
export function isIndexedDBAvailable(): boolean {
	return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

/** Generate a UUID, falling back to a manual implementation for older engines. */
export function generateId(): string {
	const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
	if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
		return cryptoObj.randomUUID();
	}
	// RFC4122 v4 fallback using getRandomValues when available.
	if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
		const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}
	// Last resort (non-cryptographic) so the app still functions.
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

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

let dbPromise: Promise<IDBDatabase> | null = null;

/** Add an index only when it does not already exist (idempotent upgrade). */
function addIndexIfMissing(store: IDBObjectStore, name: string, keyPath: string | string[]): void {
	if (!store.indexNames.contains(name)) {
		store.createIndex(name, keyPath, { unique: false });
	}
}

/**
 * Open (and lazily cache) the IndexedDB connection.
 * Rejects with a DatabaseError when IndexedDB is unavailable or fails to open.
 */
export function openDatabase(): Promise<IDBDatabase> {
	if (!isIndexedDBAvailable()) {
		return Promise.reject(
			new DatabaseError('Penyimpanan browser (IndexedDB) tidak tersedia di lingkungan ini.')
		);
	}
	if (dbPromise) return dbPromise;

	dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		let request: IDBOpenDBRequest;
		try {
			request = indexedDB.open(DB_NAME, DB_VERSION);
		} catch (error) {
			reject(new DatabaseError('Gagal membuka database browser.', error));
			return;
		}

		request.onupgradeneeded = (event) => {
			const db = request.result;
			const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

			// --- v1: activities ---
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				store.createIndex('date', 'date', { unique: false });
				store.createIndex('category', 'category', { unique: false });
				store.createIndex('completed', 'completed', { unique: false });
				store.createIndex('createdAt', 'createdAt', { unique: false });
			} else if (oldVersion < 3) {
				// Upgrade path: add v3 indexes to an existing activities store.
				const store = request.transaction!.objectStore(STORE_NAME);
				addIndexIfMissing(store, 'status', 'status');
				addIndexIfMissing(store, 'habitId', 'habitId');
				addIndexIfMissing(store, 'updatedAt', 'updatedAt');
			}

			// --- v2: steps + settings ---
			if (!db.objectStoreNames.contains(STEPS_STORE)) {
				const stepStore = db.createObjectStore(STEPS_STORE, { keyPath: 'date' });
				stepStore.createIndex('updatedAt', 'updatedAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
				db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
			}

			// --- v3: habits, habit logs, focus sessions, sync queue, metadata ---
			if (!db.objectStoreNames.contains(HABITS_STORE)) {
				const habitStore = db.createObjectStore(HABITS_STORE, { keyPath: 'id' });
				habitStore.createIndex('active', 'active', { unique: false });
				habitStore.createIndex('categoryId', 'categoryId', { unique: false });
				habitStore.createIndex('updatedAt', 'updatedAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(HABIT_LOGS_STORE)) {
				const logStore = db.createObjectStore(HABIT_LOGS_STORE, { keyPath: 'id' });
				logStore.createIndex('habitId', 'habitId', { unique: false });
				logStore.createIndex('date', 'date', { unique: false });
				// A habit has at most one log per date; enforce with a compound index.
				logStore.createIndex('habitId_date', ['habitId', 'date'], { unique: true });
			}
			if (!db.objectStoreNames.contains(FOCUS_STORE)) {
				const focusStore = db.createObjectStore(FOCUS_STORE, { keyPath: 'id' });
				focusStore.createIndex('activityId', 'activityId', { unique: false });
				focusStore.createIndex('startedAt', 'startedAt', { unique: false });
				focusStore.createIndex('status', 'status', { unique: false });
			}
			if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
				const queueStore = db.createObjectStore(SYNC_QUEUE_STORE, {
					keyPath: 'id',
					autoIncrement: true
				});
				queueStore.createIndex('entity', 'entity', { unique: false });
				queueStore.createIndex('createdAt', 'createdAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(METADATA_STORE)) {
				db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
			}
		};

		request.onsuccess = () => {
			const db = request.result;
			// If the connection is closed (e.g. version change elsewhere), reset cache.
			db.onclose = () => {
				dbPromise = null;
			};
			resolve(db);
		};

		request.onerror = () => {
			dbPromise = null;
			reject(new DatabaseError('Gagal membuka database aktivitas.', request.error));
		};

		request.onblocked = () => {
			// Another tab holds an older connection open; the upgrade is waiting.
			dbPromise = null;
			reject(
				new DatabaseError(
					'Database sedang digunakan oleh tab lain. Tutup tab lain lalu coba lagi.'
				)
			);
		};
	}).catch((error) => {
		dbPromise = null;
		throw error instanceof DatabaseError
			? error
			: new DatabaseError('Terjadi kesalahan pada database browser.', error);
	});

	return dbPromise;
}

/** Wrap an IDBRequest into a promise with consistent error handling. */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(
				new DatabaseError(
					`Operasi database gagal${request.error ? `: ${request.error.name}` : ''}.`,
					request.error
				)
			);
	});
}

async function withStore<T>(
	mode: IDBTransactionMode,
	handler: (store: IDBObjectStore) => Promise<T> | T,
	storeName: string = STORE_NAME
): Promise<T> {
	const db = await openDatabase();
	return new Promise<T>((resolve, reject) => {
		let transaction: IDBTransaction;
		try {
			transaction = db.transaction(storeName, mode);
		} catch (error) {
			reject(new DatabaseError('Gagal memulai transaksi database.', error));
			return;
		}

		const store = transaction.objectStore(storeName);
		let result: T;

		Promise.resolve(handler(store))
			.then((value) => {
				result = value;
			})
			.catch((error) => {
				try {
					transaction.abort();
				} catch {
					// ignore abort errors
				}
				reject(error instanceof DatabaseError ? error : new DatabaseError('Operasi database gagal.', error));
			});

		transaction.oncomplete = () => resolve(result);
		transaction.onerror = () =>
			reject(new DatabaseError('Transaksi database gagal.', transaction.error));
		transaction.onabort = () =>
			reject(
				new DatabaseError('Transaksi database dibatalkan.', transaction.error ?? undefined)
			);
	});
}

/** Resolve when a transaction completes; reject on error/abort. */
function waitForTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(new DatabaseError('Transaksi database gagal.', transaction.error));
		transaction.onabort = () =>
			reject(
				new DatabaseError('Transaksi database dibatalkan.', transaction.error ?? undefined)
			);
	});
}

/**
 * Low-level transaction helper for operations that issue several requests.
 * The handler receives the store and the live transaction and is responsible
 * for issuing its requests synchronously (so the transaction does not commit
 * early) and resolving when the work is done.
 */
async function withRawStore<T>(
	mode: IDBTransactionMode,
	handler: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>,
	storeName: string = STORE_NAME
): Promise<T> {
	const db = await openDatabase();
	let transaction: IDBTransaction;
	try {
		transaction = db.transaction(storeName, mode);
	} catch (error) {
		throw new DatabaseError('Gagal memulai transaksi database.', error);
	}
	const store = transaction.objectStore(storeName);
	try {
		return await handler(store, transaction);
	} catch (error) {
		try {
			transaction.abort();
		} catch {
			// ignore
		}
		throw error instanceof DatabaseError
			? error
			: new DatabaseError('Operasi database gagal.', error);
	}
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

/** Delete a single activity. */
export function deleteActivity(id: string): Promise<void> {	return withStore('readwrite', async (store) => {
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
		return new Promise<number>((resolve) => {
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
			keysRequest.onerror = () => {
				transaction.oncomplete = () => resolve(added);
			};
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
			return new Promise<number>((resolve) => {
				const keysRequest = store.getAllKeys();
				keysRequest.onsuccess = () => {
					const byDate = new Map<string, StepRecord>();
					const allRequest = store.getAll();
					allRequest.onsuccess = () => {
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
					allRequest.onerror = () => {
						transaction.oncomplete = () => resolve(added);
					};
				};
				keysRequest.onerror = () => {
					transaction.oncomplete = () => resolve(added);
				};
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
