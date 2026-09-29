/**
 * Sync engine core (pure, testable).
 *
 * Three concerns are extracted here so they can be unit-tested without
 * IndexedDB or network:
 *  1. `queueEntryToChange` — turn a stored queue entry into a SyncChange.
 *  2. `resolveConflicts`   — last-write-wins by `updatedAt` (tombstones win).
 *  3. `nextBackoffMs`      — exponential backoff for retries.
 *
 * The stateful orchestration (reading the queue, calling the adapter, applying
 * pulled changes) lives in `services/syncEngine.ts` and depends on these
 * helpers.
 */

import type { SyncQueueEntry } from '$lib/repositories/syncRepository';
import type { SyncChange } from '$lib/types/sync';

/** Convert a queue entry into a change the adapter can push. */
export function queueEntryToChange(entry: SyncQueueEntry): SyncChange {
	return {
		entity: entry.entity,
		operation: entry.operation,
		recordId: entry.recordId,
		payload: entry.operation === 'delete' ? undefined : entry.payload,
		updatedAt: entry.createdAt
	};
}

/** Stable key used in adapter accept lists and de-dup maps. */
export function changeKey(change: Pick<SyncChange, 'entity' | 'recordId'>): string {
	return `${change.entity}:${change.recordId}`;
}

/**
 * Decide whether an incoming remote change should overwrite a local record.
 * Last-write-wins by `updatedAt`; a remote delete (tombstone) always wins so
 * deletions propagate. Missing timestamps are treated as "very old".
 */
export function shouldApplyRemote(
	localUpdatedAt: string | undefined,
	remote: SyncChange
): boolean {
	// Deletions always propagate.
	if (remote.operation === 'delete') return true;
	if (!localUpdatedAt) return true;
	const local = Date.parse(localUpdatedAt);
	const remoteTime = Date.parse(remote.updatedAt);
	if (Number.isNaN(remoteTime)) return false;
	if (Number.isNaN(local)) return true;
	return remoteTime > local;
}

/**
 * Resolve a batch of remote changes into the subset that wins against the
 * currently-known local versions, keeping only the newest change per record.
 *
 * @param remoteChanges changes from the backend (may contain duplicates)
 * @param localUpdatedAt lookup of local `updatedAt` by `entity:recordId`
 */
export function resolveConflicts(
	remoteChanges: SyncChange[],
	localUpdatedAt: Map<string, string>
): SyncChange[] {
	// Keep only the newest remote change per record first.
	const newest = new Map<string, SyncChange>();
	for (const change of remoteChanges) {
		const key = changeKey(change);
		const existing = newest.get(key);
		if (!existing || shouldApplyRemote(existing.updatedAt, change)) {
			newest.set(key, change);
		}
	}

	const winners: SyncChange[] = [];
	for (const [key, change] of newest) {
		if (shouldApplyRemote(localUpdatedAt.get(key), change)) {
			winners.push(change);
		}
	}
	return winners;
}

/** Exponential backoff (capped) for the Nth failed attempt (0-based). */
export function nextBackoffMs(attempt: number, baseMs = 1000, maxMs = 5 * 60 * 1000): number {
	if (attempt <= 0) return 0;
	const ms = baseMs * 2 ** (attempt - 1);
	return Math.min(ms, maxMs);
}
