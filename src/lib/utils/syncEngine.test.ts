import { describe, expect, it } from 'vitest';
import {
	changeKey,
	nextBackoffMs,
	queueEntryToChange,
	resolveConflicts,
	shouldApplyRemote
} from '$lib/utils/syncEngine';
import type { SyncQueueEntry } from '$lib/repositories/syncRepository';
import type { SyncChange } from '$lib/types/sync';

function change(overrides: Partial<SyncChange> = {}): SyncChange {
	return {
		entity: 'activity',
		operation: 'update',
		recordId: 'a1',
		payload: { id: 'a1' },
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

describe('queueEntryToChange', () => {
	it('maps a queue entry to a change', () => {
		const entry: SyncQueueEntry = {
			id: 1,
			entity: 'habit',
			operation: 'create',
			recordId: 'h1',
			payload: { id: 'h1' },
			createdAt: '2024-03-05T08:00:00.000Z',
			attempts: 0
		};
		const result = queueEntryToChange(entry);
		expect(result).toEqual({
			entity: 'habit',
			operation: 'create',
			recordId: 'h1',
			payload: { id: 'h1' },
			updatedAt: '2024-03-05T08:00:00.000Z'
		});
	});

	it('drops the payload for deletes', () => {
		const entry: SyncQueueEntry = {
			id: 2,
			entity: 'activity',
			operation: 'delete',
			recordId: 'a1',
			payload: { id: 'a1' },
			createdAt: '2024-03-05T08:00:00.000Z',
			attempts: 0
		};
		expect(queueEntryToChange(entry).payload).toBeUndefined();
	});
});

describe('changeKey', () => {
	it('combines entity and record id', () => {
		expect(changeKey({ entity: 'focusSession', recordId: 'f9' })).toBe('focusSession:f9');
	});
});

describe('shouldApplyRemote', () => {
	it('applies when there is no local record', () => {
		expect(shouldApplyRemote(undefined, change())).toBe(true);
	});

	it('applies when remote is newer', () => {
		expect(
			shouldApplyRemote('2024-03-05T08:00:00.000Z', change({ updatedAt: '2024-03-05T09:00:00.000Z' }))
		).toBe(true);
	});

	it('rejects when local is newer', () => {
		expect(
			shouldApplyRemote('2024-03-05T10:00:00.000Z', change({ updatedAt: '2024-03-05T09:00:00.000Z' }))
		).toBe(false);
	});

	it('applies a remote delete regardless of timestamps', () => {
		expect(
			shouldApplyRemote('2099-01-01T00:00:00.000Z', change({ operation: 'delete' }))
		).toBe(true);
	});

	it('rejects a remote change with an unparseable timestamp', () => {
		expect(shouldApplyRemote('2024-03-05T08:00:00.000Z', change({ updatedAt: 'nonsense' }))).toBe(
			false
		);
	});

	it('applies when the local timestamp is unparseable', () => {
		expect(shouldApplyRemote('nonsense', change())).toBe(true);
	});
});

describe('resolveConflicts', () => {
	it('keeps only the newest remote change per record', () => {
		const winners = resolveConflicts(
			[
				change({ recordId: 'a1', updatedAt: '2024-03-05T08:00:00.000Z' }),
				change({ recordId: 'a1', updatedAt: '2024-03-05T09:00:00.000Z' })
			],
			new Map()
		);
		expect(winners).toHaveLength(1);
		expect(winners[0].updatedAt).toBe('2024-03-05T09:00:00.000Z');
	});

	it('filters out records where the local copy wins', () => {
		const winners = resolveConflicts(
			[change({ recordId: 'a1', updatedAt: '2024-03-05T08:00:00.000Z' })],
			new Map([['activity:a1', '2024-03-05T10:00:00.000Z']])
		);
		expect(winners).toEqual([]);
	});

	it('keeps remote changes for unknown records', () => {
		const winners = resolveConflicts([change({ recordId: 'new' })], new Map());
		expect(winners).toHaveLength(1);
	});
});

describe('nextBackoffMs', () => {
	it('is zero for the first attempt', () => {
		expect(nextBackoffMs(0)).toBe(0);
	});

	it('doubles each attempt', () => {
		expect(nextBackoffMs(1)).toBe(1000);
		expect(nextBackoffMs(2)).toBe(2000);
		expect(nextBackoffMs(3)).toBe(4000);
	});

	it('caps at the maximum', () => {
		expect(nextBackoffMs(20)).toBe(5 * 60 * 1000);
	});
});
