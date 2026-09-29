import { describe, expect, it } from 'vitest';
import {
	defaultReminder,
	dueOccurrence,
	fireTimestamp,
	hasReminder,
	pendingOccurrences,
	resolveReminderTime
} from './reminderEngine';
import type { Activity } from '$lib/types/activity';

function act(partial: Partial<Activity> & { id: string }): Activity {
	return {
		name: 'A',
		category: 'Other',
		date: '2024-01-15',
		duration: 60,
		completed: false,
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
		...partial
	} as Activity;
}

describe('fireTimestamp', () => {
	it('builds a local timestamp', () => {
		const ts = fireTimestamp('2024-01-15', '09:30');
		expect(ts).toBe(new Date(2024, 0, 15, 9, 30, 0, 0).getTime());
	});
	it('returns null for malformed input', () => {
		expect(fireTimestamp('nope', '09:30')).toBeNull();
		expect(fireTimestamp('2024-01-15', 'noon')).toBeNull();
	});
});

describe('resolveReminderTime', () => {
	it('returns explicit reminder time', () => {
		const a = act({ id: '1', reminder: { ...defaultReminder(), time: '08:00' } });
		expect(resolveReminderTime(a)).toBe('08:00');
	});
	it('derives time from startTime minus minutesBefore', () => {
		const a = act({
			id: '1',
			startTime: '09:00',
			reminder: { enabled: true, sound: true, vibration: true, snoozeMinutes: 5, minutesBefore: 15 }
		});
		expect(resolveReminderTime(a)).toBe('08:45');
	});
	it('wraps around midnight', () => {
		const a = act({
			id: '1',
			startTime: '00:10',
			reminder: { enabled: true, sound: true, vibration: true, snoozeMinutes: 5, minutesBefore: 30 }
		});
		expect(resolveReminderTime(a)).toBe('23:40');
	});
	it('returns null when disabled', () => {
		const a = act({ id: '1', startTime: '09:00', reminder: { ...defaultReminder(), enabled: false } });
		expect(resolveReminderTime(a)).toBeNull();
	});
	it('returns null without any time source', () => {
		const a = act({ id: '1', reminder: defaultReminder() });
		expect(resolveReminderTime(a)).toBeNull();
	});
});

describe('hasReminder', () => {
	it('is true only when enabled with a resolvable time', () => {
		expect(hasReminder(act({ id: '1', reminder: defaultReminder({ time: '08:00' }) }))).toBe(true);
		expect(hasReminder(act({ id: '1' }))).toBe(false);
		expect(hasReminder(act({ id: '1', reminder: defaultReminder() }))).toBe(false);
	});
});

describe('pendingOccurrences', () => {
	it('includes a reminder within the horizon', () => {
		const now = new Date(2024, 0, 15, 8, 30).getTime();
		const a = act({ id: '1', reminder: defaultReminder({ time: '09:00' }) });
		const result = pendingOccurrences([a], now, 60 * 60 * 1000);
		expect(result).toHaveLength(1);
		expect(result[0].time).toBe('09:00');
	});

	it('excludes reminders beyond the horizon', () => {
		const now = new Date(2024, 0, 15, 6, 0).getTime();
		const a = act({ id: '1', reminder: defaultReminder({ time: '09:00' }) });
		expect(pendingOccurrences([a], now, 60 * 60 * 1000)).toHaveLength(0);
	});

	it('lets snooze override the scheduled time', () => {
		const now = new Date(2024, 0, 15, 8, 0).getTime();
		const snoozeAt = new Date(2024, 0, 15, 8, 30).toISOString();
		const a = act({
			id: '1',
			reminder: defaultReminder({ time: '09:00' }),
			snoozedUntil: snoozeAt
		});
		const result = pendingOccurrences([a], now, 60 * 60 * 1000);
		expect(result).toHaveLength(1);
		expect(result[0].fireAt).toBe(new Date(snoozeAt).getTime());
	});

	it('sorts by fire time', () => {
		const now = new Date(2024, 0, 15, 8, 0).getTime();
		const a = act({ id: '1', reminder: defaultReminder({ time: '09:00' }) });
		const b = act({ id: '2', reminder: defaultReminder({ time: '08:30' }) });
		const result = pendingOccurrences([a, b], now, 60 * 60 * 1000);
		expect(result.map((o) => o.activityId)).toEqual(['2', '1']);
	});
});

describe('dueOccurrence', () => {
	const now = new Date(2024, 0, 15, 9, 0, 30).getTime();

	it('returns a due occurrence', () => {
		const a = act({ id: '1', reminder: defaultReminder({ time: '09:00' }) });
		const occ = dueOccurrence([a], now, new Set());
		expect(occ?.activityId).toBe('1');
	});

	it('ignores already-fired keys', () => {
		const a = act({ id: '1', reminder: defaultReminder({ time: '09:00' }) });
		const fired = new Set([`1@2024-01-15T09:00`]);
		expect(dueOccurrence([a], now, fired)).toBeNull();
	});

	it('ignores reminders outside the grace window', () => {
		const a = act({ id: '1', reminder: defaultReminder({ time: '09:00' }) });
		const later = new Date(2024, 0, 15, 9, 5).getTime();
		expect(dueOccurrence([a], later, new Set())).toBeNull();
	});

	it('fires a snoozed occurrence when due', () => {
		const snoozeAt = new Date(2024, 0, 15, 9, 0).toISOString();
		const a = act({ id: '1', reminder: defaultReminder({ time: '08:00' }), snoozedUntil: snoozeAt });
		const occ = dueOccurrence([a], now, new Set());
		expect(occ?.key).toBe(`1@${snoozeAt}`);
	});
});

describe('defaultReminder', () => {
	it('enables sound/vibration and a 5 minute snooze', () => {
		const r = defaultReminder();
		expect(r.enabled).toBe(true);
		expect(r.sound).toBe(true);
		expect(r.vibration).toBe(true);
		expect(r.snoozeMinutes).toBe(5);
	});
	it('applies overrides', () => {
		expect(defaultReminder({ snoozeMinutes: 15 }).snoozeMinutes).toBe(15);
	});
});
