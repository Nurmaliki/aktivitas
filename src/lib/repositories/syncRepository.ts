/**
 * Sync queue + metadata repository (IndexedDB).
 *
 * The sync queue records local mutations (create/update/delete) that must be
 * pushed to a remote backend when one is configured. In local-only mode the
 * queue simply accumulates and is harmless.
 *
 * Queue entry ids are auto-incremented by IndexedDB; the `id` field is typed as
 * optional on input and always present on read.
 */

import {
	DatabaseError,
	STORES,
	requestToPromise,
	withStore
} from './db-core';

export type SyncEntity = 'activity' | 'habit' | 'habitLog' | 'focusSession' | 'settings' | 'step';
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncQueueEntry {
	id?: number;
	entity: SyncEntity;
	operation: SyncOperation;
	/** The record id this mutation applies to. */
	recordId: string;
	/** Snapshot of the record payload at mutation time (for create/update). */
	payload?: unknown;
	createdAt: string;
	/** Number of failed push attempts (for backoff). */
	attempts: number;
}

export function enqueue(entry: Omit<SyncQueueEntry, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
	const record: SyncQueueEntry = {
		...entry,
		createdAt: new Date().toISOString(),
		attempts: 0
	};
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.add(record));
		},
		STORES.syncQueue
	);
}

export function getQueue(): Promise<SyncQueueEntry[]> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown[]>(store.getAll());
			return raw
				.filter((r): r is SyncQueueEntry => typeof r === 'object' && r !== null)
				.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
		},
		STORES.syncQueue
	);
}

export function getQueueSize(): Promise<number> {
	return withStore(
		'readonly',
		(store) => requestToPromise<number>(store.count()),
		STORES.syncQueue
	);
}

export function removeFromQueue(id: number): Promise<void> {
	return withStore('readwrite', (store) => requestToPromise(store.delete(id)), STORES.syncQueue);
}

export function clearQueue(): Promise<void> {
	return withStore('readwrite', (store) => requestToPromise(store.clear()), STORES.syncQueue);
}

export function bumpAttempts(id: number): Promise<void> {
	return withStore(
		'readwrite',
		async (store) => {
			const raw = await requestToPromise<unknown>(store.get(id));
			if (typeof raw !== 'object' || raw === null) return;
			const entry = raw as SyncQueueEntry;
			await requestToPromise(store.put({ ...entry, attempts: (entry.attempts ?? 0) + 1 }));
		},
		STORES.syncQueue
	);
}

// ---- Metadata key/value ---------------------------------------------------

export interface MetadataRecord {
	key: string;
	value: string;
	updatedAt: string;
}

export function getMetadata(key: string): Promise<string | undefined> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown>(store.get(key));
			if (typeof raw === 'object' && raw !== null && 'value' in raw) {
				const value = (raw as { value: unknown }).value;
				return typeof value === 'string' ? value : undefined;
			}
			return undefined;
		},
		STORES.metadata
	);
}

export function setMetadata(key: string, value: string): Promise<void> {
	return withStore(
		'readwrite',
		async (store) => {
			const record: MetadataRecord = { key, value, updatedAt: new Date().toISOString() };
			await requestToPromise(store.put(record));
		},
		STORES.metadata
	);
}

export function deleteMetadata(key: string): Promise<void> {
	return withStore('readwrite', (store) => requestToPromise(store.delete(key)), STORES.metadata);
}

export { DatabaseError };
