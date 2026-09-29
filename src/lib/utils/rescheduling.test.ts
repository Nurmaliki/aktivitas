import { describe, expect, it } from 'vitest';
import { findMissedActivities, missedMessage, rescheduleOptions } from './rescheduling';
import type { Activity } from '$lib/types/activity';

function act(partial: Partial<Activity> & { id: string; date: string }): Activity {
	return {
		name: 'A',
		category: 'Other',
		duration: 60,
		completed: false,
		createdAt: 'x',
		updatedAt: 'x',
		...partial
	} as Activity;
}

const TODAY = '2024-01-15';
// 2024-01-15 12:00 local.
const NOW = new Date(2024, 0, 15, 12, 0);

describe('findMissedActivities', () => {
	it('flags past-date unfinished activities', () => {
		const list = [act({ id: '1', date: '2024-01-10' })];
		const missed = findMissedActivities(list, TODAY, NOW);
		expect(missed).toHaveLength(1);
		expect(missed[0].reason).toBe('past-date');
	});

	it('flags today activities whose time has passed', () => {
		const list = [act({ id: '1', date: TODAY, startTime: '09:00', duration: 60 })];
		const missed = findMissedActivities(list, TODAY, NOW);
		expect(missed).toHaveLength(1);
		expect(missed[0].reason).toBe('past-time');
	});

	it('does not flag today activities still in the future', () => {
		const list = [act({ id: '1', date: TODAY, startTime: '18:00', duration: 60 })];
		expect(findMissedActivities(list, TODAY, NOW)).toHaveLength(0);
	});

	it('never flags completed activities', () => {
		const list = [act({ id: '1', date: '2024-01-10', completed: true })];
		expect(findMissedActivities(list, TODAY, NOW)).toHaveLength(0);
	});

	it('ignores skipped activities', () => {
		const list = [act({ id: '1', date: '2024-01-10', status: 'skipped' })];
		expect(findMissedActivities(list, TODAY, NOW)).toHaveLength(0);
	});

	it('does not flag future-dated planned activities', () => {
		const list = [act({ id: '1', date: '2024-02-01' })];
		expect(findMissedActivities(list, TODAY, NOW)).toHaveLength(0);
	});

	it('does not flag today activities without a time', () => {
		const list = [act({ id: '1', date: TODAY })];
		expect(findMissedActivities(list, TODAY, NOW)).toHaveLength(0);
	});
});

describe('rescheduleOptions', () => {
	it('always offers tomorrow', () => {
		const a = act({ id: '1', date: '2024-01-10' });
		const options = rescheduleOptions(a, [a], TODAY, NOW);
		expect(options.some((o) => o.id === 'tomorrow')).toBe(true);
	});

	it('offers later-today when a slot exists after now', () => {
		const a = act({ id: '1', date: '2024-01-10', duration: 30 });
		const options = rescheduleOptions(a, [a], TODAY, NOW);
		expect(options.some((o) => o.id === 'later-today')).toBe(true);
	});

	it('preserves the original time for tomorrow', () => {
		const a = act({ id: '1', date: '2024-01-10', startTime: '09:00', endTime: '10:00' });
		const options = rescheduleOptions(a, [a], TODAY, NOW);
		const tomorrow = options.find((o) => o.id === 'tomorrow')!;
		expect(tomorrow.startTime).toBe('09:00');
		expect(tomorrow.date).toBe('2024-01-16');
	});

	it('omits later-today when the day is fully booked', () => {
		const a = act({ id: '1', date: '2024-01-10', duration: 30 });
		const busy = act({ id: '2', date: TODAY, startTime: '06:00', duration: 16 * 60 });
		const options = rescheduleOptions(a, [a, busy], TODAY, NOW);
		expect(options.some((o) => o.id === 'later-today')).toBe(false);
	});

	it('suggests a slot on the target date', () => {
		const a = act({ id: '1', date: '2024-01-10', duration: 30 });
		const options = rescheduleOptions(a, [a], TODAY, NOW);
		expect(options.some((o) => o.id === 'slot')).toBe(true);
	});
});

describe('missedMessage', () => {
	it('describes a past-date miss', () => {
		const msg = missedMessage({ activity: act({ id: '1', date: '2024-01-10', name: 'Coding' }), reason: 'past-date' });
		expect(msg).toContain('Coding');
		expect(msg).toContain('belum selesai');
	});
	it('describes a past-time miss', () => {
		const msg = missedMessage({ activity: act({ id: '1', date: TODAY, name: 'Meeting' }), reason: 'past-time' });
		expect(msg).toContain('Meeting');
	});
});
