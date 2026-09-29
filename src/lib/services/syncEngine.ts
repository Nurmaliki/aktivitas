/**
 * Sync engine orchestration.
 *
 * Local-first: IndexedDB stays the source of truth. When a remote adapter is
 * configured (feature flag via PUBLIC_SYNC_* env vars) this module:
 *   1. pushes queued local mutations to the backend,
 *   2. pulls remote changes and resolves conflicts (last-write-wins, tombstones
 *      win — see `utils/syncEngine.ts`),
 *   3. applies the winning remote records to the local repositories.
 *
 * When sync is disabled the engine is inert: nothing is pushed, nothing is
 * pulled, and the local queue simply accumulates harmlessly.
 */

import type { Activity } from '$lib/types/activity';
import type { Habit, HabitLog } from '$lib/types/habit';
import type { FocusSession } from '$lib/types/focus';
import type { SyncAdapter, SyncChange, SyncStatus } from '$lib/types/sync';
import { isValidActivity } from '$lib/utils/validation';
import { isValidHabit, isValidHabitLog, isValidFocusSession } from '$lib/utils/validators';
import {
	changeKey,
	queueEntryToChange,
	resolveConflicts
} from '$lib/utils/syncEngine';
import {
	getActivities,
	upsertActivity,
	deleteActivity
} from '$lib/services/db';
import {
	getHabits,
	getHabitLogs,
	upsertHabit,
	upsertHabitLog
} from '$lib/repositories/habitRepository';
import { getFocusSessions, upsertFocusSession } from '$lib/repositories/focusRepository';
import {
	bumpAttempts,
	getMetadata,
	getQueue,
	getQueueSize,
	removeFromQueue,
	setMetadata,
	type SyncQueueEntry
} from '$lib/repositories/syncRepository';

const CURSOR_KEY = 'sync_cursor';
const LAST_SYNC_KEY = 'sync_last_at';

export interface SyncRunResult {
	pushed: number;
	pulled: number;
	applied: number;
	error?: string;
}

/**
 * Push all queued mutations to the adapter. Entries the adapter accepts are
 * removed from the queue; failures bump the attempt counter and are left in
 * place for a later retry. Backoff is exposed via `nextBackoffMs` (utils) but
 * not yet applied by an automatic scheduler, so retries happen on the next
 * manual/triggered sync.
 */
export async function pushQueue(adapter: SyncAdapter): Promise<number> {
	const queue = await getQueue();
	if (queue.length === 0) return 0;

	const changes: SyncChange[] = queue.map(queueEntryToChange);
	const result = await adapter.push(changes);
	const accepted = new Set(result.accepted);

	let pushed = 0;
	for (const entry of queue) {
		if (entry.id == null) continue;
		const key = changeKey(queueEntryToChange(entry));
		if (accepted.has(key) || accepted.has(entry.recordId)) {
			await removeFromQueue(entry.id);
			pushed += 1;
		} else {
			await bumpAttempts(entry.id);
		}
	}
	return pushed;
}

/** Build a `entity:recordId -> updatedAt` map of local records. */
async function buildLocalTimestampMap(): Promise<Map<string, string>> {
	const [activities, habits, habitLogs, focusSessions] = await Promise.all([
		getActivities(),
		getHabits(),
		getHabitLogs(),
		getFocusSessions()
	]);
	const map = new Map<string, string>();
	for (const a of activities) map.set(`activity:${a.id}`, a.updatedAt);
	for (const h of habits) map.set(`habit:${h.id}`, h.updatedAt);
	for (const l of habitLogs) map.set(`habitLog:${l.id}`, l.updatedAt);
	for (const f of focusSessions) map.set(`focusSession:${f.id}`, f.updatedAt);
	return map;
}

/** Apply a single winning remote change to the matching local repository. */
async function applyChange(change: SyncChange): Promise<boolean> {
	const payload = change.payload;
	switch (change.entity) {
		case 'activity':
			if (change.operation === 'delete') {
				// A winning remote delete (tombstone) removes the local record so
				// deletions propagate in both directions.
				if (change.recordId) {
					await deleteActivity(change.recordId);
					return true;
				}
				return false;
			}
			if (isValidActivity(payload)) {
				await upsertActivity(payload as Activity);
				return true;
			}
			return false;
		case 'habit':
			if (isValidHabit(payload)) {
				await upsertHabit(payload as Habit);
				return true;
			}
			return false;
		case 'habitLog':
			if (isValidHabitLog(payload)) {
				await upsertHabitLog(payload as HabitLog);
				return true;
			}
			return false;
		case 'focusSession':
			if (isValidFocusSession(payload)) {
				await upsertFocusSession(payload as FocusSession);
				return true;
			}
			return false;
		default:
			// settings/steps: not synced via this path yet.
			return false;
	}
}

/** Pull remote changes, resolve conflicts and apply winners locally. */
export async function pullAndApply(adapter: SyncAdapter): Promise<number> {
	const cursor = (await getMetadata(CURSOR_KEY)) || undefined;
	const result = await adapter.pull(cursor);
	if (!result.changes.length) {
		if (result.cursor) await setMetadata(CURSOR_KEY, result.cursor);
		return 0;
	}

	const localTimestamps = await buildLocalTimestampMap();
	const winners = resolveConflicts(result.changes, localTimestamps);

	let applied = 0;
	for (const change of winners) {
		if (await applyChange(change)) applied += 1;
	}

	if (result.cursor) await setMetadata(CURSOR_KEY, result.cursor);
	return applied;
}

/** Run one full sync cycle (push then pull). Never throws. */
export async function runSync(adapter: SyncAdapter): Promise<SyncRunResult> {
	if (!adapter.enabled) return { pushed: 0, pulled: 0, applied: 0 };
	let pushed = 0;
	let applied = 0;
	try {
		pushed = await pushQueue(adapter);
	} catch (error) {
		return {
			pushed,
			pulled: 0,
			applied: 0,
			error: error instanceof Error ? error.message : 'Sinkronisasi gagal.'
		};
	}
	try {
		applied = await pullAndApply(adapter);
		await setMetadata(LAST_SYNC_KEY, new Date().toISOString());
		return { pushed, pulled: applied, applied };
	} catch (error) {
		// Push already succeeded; report that progress rather than zeroing it.
		return {
			pushed,
			pulled: 0,
			applied,
			error: error instanceof Error ? error.message : 'Sinkronisasi gagal.'
		};
	}
}

/** Read the current sync status snapshot (adapter id + queue depth). */
export async function readStatus(adapter: SyncAdapter): Promise<SyncStatus> {
	if (!adapter.enabled) {
		return { state: 'disabled', adapter: adapter.id, pending: 0 };
	}
	try {
		const [pending, lastSyncedAt] = await Promise.all([
			getQueueSize(),
			getMetadata(LAST_SYNC_KEY)
		]);
		return {
			state: 'idle',
			adapter: adapter.id,
			pending,
			lastSyncedAt
		};
	} catch (error) {
		return {
			state: 'error',
			adapter: adapter.id,
			pending: 0,
			error: error instanceof Error ? error.message : 'Gagal membaca status sinkronisasi.'
		};
	}
}

export type { SyncQueueEntry };
