/**
 * Focus session repository (IndexedDB).
 *
 * A focus session is the persisted record of a pomodoro/stopwatch run. Timer
 * truth is derived from timestamps (startedAt + totalPausedMs), so a session can
 * always be reconstructed after a page refresh.
 */

import type { FocusSession } from '$lib/types/focus';
import { isValidFocusSession } from '$lib/utils/validators';
import {
	DatabaseError,
	STORES,
	generateId,
	requestToPromise,
	withStore,
	withRawStore,
	waitForTransaction
} from './db-core';

export function getFocusSessions(): Promise<FocusSession[]> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown[]>(store.getAll());
			return raw.filter(isValidFocusSession).filter((session) => !session.deletedAt);
		},
		STORES.focusSessions
	);
}

/** All sessions that are still running or paused (for refresh recovery). */
export function getActiveFocusSessions(): Promise<FocusSession[]> {
	return withStore(
		'readonly',
		async (store) => {
			const raw = await requestToPromise<unknown[]>(store.getAll());
			return raw
				.filter(isValidFocusSession)
				.filter((s) => !s.deletedAt && (s.status === 'running' || s.status === 'paused'));
		},
		STORES.focusSessions
	);
}

export function addFocusSession(session: Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<FocusSession> {
	const now = new Date().toISOString();
	const record: FocusSession = {
		...session,
		id: generateId(),
		createdAt: now,
		updatedAt: now,
		syncStatus: 'pending'
	};
	return withStore(
		'readwrite',
		async (store) => {
			await requestToPromise(store.add(record));
			return record;
		},
		STORES.focusSessions
	);
}

export function updateFocusSession(
	id: string,
	changes: Partial<Omit<FocusSession, 'id' | 'createdAt'>>
): Promise<FocusSession> {
	return withStore(
		'readwrite',
		async (store) => {
			const raw = await requestToPromise<unknown>(store.get(id));
			if (!isValidFocusSession(raw)) {
				throw new DatabaseError('Sesi fokus tidak ditemukan.');
			}
			const updated: FocusSession = {
				...raw,
				...changes,
				id,
				createdAt: raw.createdAt,
				updatedAt: new Date().toISOString(),
				syncStatus: 'pending'
			};
			await requestToPromise(store.put(updated));
			return updated;
		},
		STORES.focusSessions
	);
}

export function deleteFocusSession(id: string): Promise<void> {
	return withStore(
		'readwrite',
		(store) => requestToPromise(store.delete(id)),
		STORES.focusSessions
	);
}

export function purgeAllFocusSessions(): Promise<void> {
	return withStore('readwrite', (store) => requestToPromise(store.clear()), STORES.focusSessions);
}

export function replaceFocusSessions(sessions: FocusSession[]): Promise<void> {
	return withRawStore(
		'readwrite',
		(store, transaction) => {
			store.clear();
			for (const session of sessions) store.put(session);
			return waitForTransaction(transaction);
		},
		STORES.focusSessions
	);
}

export function mergeFocusSessions(sessions: FocusSession[]): Promise<number> {
	return withRawStore(
		'readwrite',
		(store, transaction) =>
			new Promise<number>((resolve) => {
				const keysReq = store.getAllKeys();
				keysReq.onsuccess = () => {
					const existing = new Set(keysReq.result.map(String));
					let added = 0;
					for (const session of sessions) {
						if (existing.has(session.id)) continue;
						store.put(session);
						existing.add(session.id);
						added += 1;
					}
					void transaction;
					resolve(added);
				};
				keysReq.onerror = () => resolve(0);
			}),
		STORES.focusSessions
	);
}
