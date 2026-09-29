/**
 * Low-level IndexedDB access primitives shared by all repositories.
 *
 * This is a thin extraction of the connection/transaction helpers originally
 * living in `db.ts`, so new repositories (habits, focus, sync) can reuse them
 * without duplicating transaction handling.
 *
 * Everything here is browser-only and SSR-safe (guards on `indexedDB`).
 */

export const DB_NAME = 'daily-activity-db';
export const DB_VERSION = 3;

export const STORES = {
	activities: 'activities',
	steps: 'steps',
	settings: 'settings',
	habits: 'habits',
	habitLogs: 'habitLogs',
	focusSessions: 'focusSessions',
	syncQueue: 'syncQueue',
	metadata: 'metadata'
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export class DatabaseError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'DatabaseError';
	}
}

export function isIndexedDBAvailable(): boolean {
	return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

export function generateId(): string {
	const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
	if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
		return cryptoObj.randomUUID();
	}
	if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
		const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

let dbPromise: Promise<IDBDatabase> | null = null;

function addIndexIfMissing(store: IDBObjectStore, name: string, keyPath: string | string[]): void {
	if (!store.indexNames.contains(name)) {
		store.createIndex(name, keyPath, { unique: false });
	}
}

/**
 * Open (and lazily cache) the IndexedDB connection.
 * The schema is identical to `db.ts` — this module and `db.ts` share the same
 * database, so upgrades must stay in sync.
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

			if (!db.objectStoreNames.contains(STORES.activities)) {
				const store = db.createObjectStore(STORES.activities, { keyPath: 'id' });
				store.createIndex('date', 'date', { unique: false });
				store.createIndex('category', 'category', { unique: false });
				store.createIndex('completed', 'completed', { unique: false });
				store.createIndex('createdAt', 'createdAt', { unique: false });
			} else if (oldVersion < 3) {
				const store = request.transaction!.objectStore(STORES.activities);
				addIndexIfMissing(store, 'status', 'status');
				addIndexIfMissing(store, 'habitId', 'habitId');
				addIndexIfMissing(store, 'updatedAt', 'updatedAt');
			}

			if (!db.objectStoreNames.contains(STORES.steps)) {
				const stepStore = db.createObjectStore(STORES.steps, { keyPath: 'date' });
				stepStore.createIndex('updatedAt', 'updatedAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(STORES.settings)) {
				db.createObjectStore(STORES.settings, { keyPath: 'key' });
			}
			if (!db.objectStoreNames.contains(STORES.habits)) {
				const habitStore = db.createObjectStore(STORES.habits, { keyPath: 'id' });
				habitStore.createIndex('active', 'active', { unique: false });
				habitStore.createIndex('categoryId', 'categoryId', { unique: false });
				habitStore.createIndex('updatedAt', 'updatedAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(STORES.habitLogs)) {
				const logStore = db.createObjectStore(STORES.habitLogs, { keyPath: 'id' });
				logStore.createIndex('habitId', 'habitId', { unique: false });
				logStore.createIndex('date', 'date', { unique: false });
				logStore.createIndex('habitId_date', ['habitId', 'date'], { unique: true });
			}
			if (!db.objectStoreNames.contains(STORES.focusSessions)) {
				const focusStore = db.createObjectStore(STORES.focusSessions, { keyPath: 'id' });
				focusStore.createIndex('activityId', 'activityId', { unique: false });
				focusStore.createIndex('startedAt', 'startedAt', { unique: false });
				focusStore.createIndex('status', 'status', { unique: false });
			}
			if (!db.objectStoreNames.contains(STORES.syncQueue)) {
				const queueStore = db.createObjectStore(STORES.syncQueue, {
					keyPath: 'id',
					autoIncrement: true
				});
				queueStore.createIndex('entity', 'entity', { unique: false });
				queueStore.createIndex('createdAt', 'createdAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(STORES.metadata)) {
				db.createObjectStore(STORES.metadata, { keyPath: 'key' });
			}
		};

		request.onsuccess = () => {
			const db = request.result;
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

/** Reset the cached connection (used after a destructive operation/tests). */
export function resetConnection(): void {
	dbPromise = null;
}

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

/**
 * Run a handler inside a single-store transaction.
 * The handler should issue its requests in order; the promise resolves after
 * the transaction commits (so the caller always sees persisted state).
 */
export async function withStore<T>(
	mode: IDBTransactionMode,
	handler: (store: IDBObjectStore) => Promise<T> | T,
	storeName: StoreName
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
					/* ignore */
				}
				reject(
					error instanceof DatabaseError
						? error
						: new DatabaseError('Operasi database gagal.', error)
				);
			});

		transaction.oncomplete = () => resolve(result);
		transaction.onerror = () =>
			reject(new DatabaseError('Transaksi database gagal.', transaction.error));
		transaction.onabort = () =>
			reject(new DatabaseError('Transaksi database dibatalkan.', transaction.error ?? undefined));
	});
}

/** Multi-request transaction helper (handler must issue requests synchronously). */
export async function withRawStore<T>(
	mode: IDBTransactionMode,
	handler: (store: IDBObjectStore, transaction: IDBTransaction) => Promise<T>,
	storeName: StoreName
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
			/* ignore */
		}
		throw error instanceof DatabaseError
			? error
			: new DatabaseError('Operasi database gagal.', error);
	}
}

export function waitForTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(new DatabaseError('Transaksi database gagal.', transaction.error));
		transaction.onabort = () =>
			reject(new DatabaseError('Transaksi database dibatalkan.', transaction.error ?? undefined));
	});
}

export { requestToPromise };
