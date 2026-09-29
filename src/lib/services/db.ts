import type { Activity, ActivityInput } from '$lib/types/activity';
import { isValidActivity } from '$lib/utils/validation';

export const DB_NAME = 'daily-activity-db';
export const DB_VERSION = 1;
export const STORE_NAME = 'activities';

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

let dbPromise: Promise<IDBDatabase> | null = null;

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

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
				store.createIndex('date', 'date', { unique: false });
				store.createIndex('category', 'category', { unique: false });
				store.createIndex('completed', 'completed', { unique: false });
				store.createIndex('createdAt', 'createdAt', { unique: false });
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
	handler: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
	const db = await openDatabase();
	return new Promise<T>((resolve, reject) => {
		let transaction: IDBTransaction;
		try {
			transaction = db.transaction(STORE_NAME, mode);
		} catch (error) {
			reject(new DatabaseError('Gagal memulai transaksi database.', error));
			return;
		}

		const store = transaction.objectStore(STORE_NAME);
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
	handler: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>
): Promise<T> {
	const db = await openDatabase();
	let transaction: IDBTransaction;
	try {
		transaction = db.transaction(STORE_NAME, mode);
	} catch (error) {
		throw new DatabaseError('Gagal memulai transaksi database.', error);
	}
	const store = transaction.objectStore(STORE_NAME);
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

/** Read every activity, filtering out malformed records. */
export function getActivities(): Promise<Activity[]> {
	return withStore('readonly', async (store) => {
		const raw = await requestToPromise(store.getAll());
		return raw.filter(isValidActivity);
	});
}

/** Read a single activity by id. */
export function getActivity(id: string): Promise<Activity | undefined> {
	return withStore('readonly', async (store) => {
		const raw = await requestToPromise<unknown>(store.get(id));
		return isValidActivity(raw) ? raw : undefined;
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
