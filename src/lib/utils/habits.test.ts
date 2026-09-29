import { describe, expect, it } from 'vitest';
import {
	calculateCompletionRate,
	calculateCurrentStreak,
	calculateLongestStreak,
	heatLevel,
	indexLogs,
	isScheduledOn,
	summarize
} from './habits';
import type { Habit, HabitLog } from '$lib/types/habit';

function habit(partial: Partial<Habit> & { id: string }): Habit {
	return {
		name: 'H',
		frequency: 'daily',
		targetPerPeriod: 1,
		active: true,
		createdAt: 'x',
		updatedAt: 'x',
		...partial
	} as Habit;
}

function log(habitId: string, date: string, completed = true): HabitLog {
	return { id: `${habitId}-${date}`, habitId, date, completed, updatedAt: 'x' };
}

// 2024-01-15 is a Monday.
const MON = '2024-01-15';
const SUN = '2024-01-21';
const SAT = '2024-01-20';

describe('isScheduledOn', () => {
	it('daily is always scheduled', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		expect(isScheduledOn(h, MON)).toBe(true);
		expect(isScheduledOn(h, SUN)).toBe(true);
	});
	it('weekdays only Mon-Fri', () => {
		const h = habit({ id: '1', frequency: 'weekdays' });
		expect(isScheduledOn(h, MON)).toBe(true);
		expect(isScheduledOn(h, SAT)).toBe(false);
		expect(isScheduledOn(h, SUN)).toBe(false);
	});
	it('custom respects daysOfWeek', () => {
		const h = habit({ id: '1', frequency: 'custom', daysOfWeek: [1, 3, 5] }); // Mon/Wed/Fri
		expect(isScheduledOn(h, MON)).toBe(true); // Mon
		expect(isScheduledOn(h, '2024-01-16')).toBe(false); // Tue
	});
	it('custom with no days falls back to daily', () => {
		const h = habit({ id: '1', frequency: 'custom', daysOfWeek: [] });
		expect(isScheduledOn(h, SUN)).toBe(true);
	});
});

describe('calculateCurrentStreak', () => {
	it('counts consecutive daily completions', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		const logs = [log('1', '2024-01-15'), log('1', '2024-01-14'), log('1', '2024-01-13')];
		expect(calculateCurrentStreak(h, logs, { today: '2024-01-15' })).toBe(3);
	});

	it('allows today to be incomplete without breaking the streak', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		const logs = [log('1', '2024-01-14'), log('1', '2024-01-13')];
		expect(calculateCurrentStreak(h, logs, { today: '2024-01-15' })).toBe(2);
	});

	it('breaks on a missed scheduled day', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		const logs = [log('1', '2024-01-15'), log('1', '2024-01-13')]; // 14 missing
		expect(calculateCurrentStreak(h, logs, { today: '2024-01-15' })).toBe(1);
	});

	it('weekday habit is NOT broken by a weekend', () => {
		const h = habit({ id: '1', frequency: 'weekdays' });
		// Fri 2024-01-19 completed, Sat/Sun not scheduled, "today" is Sun 21.
		const logs = [
			log('1', '2024-01-19'), // Fri
			log('1', '2024-01-18'), // Thu
			log('1', '2024-01-17') // Wed
		];
		expect(calculateCurrentStreak(h, logs, { today: SUN })).toBe(3);
	});

	it('returns 0 with no logs', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		expect(calculateCurrentStreak(h, [], { today: MON })).toBe(0);
	});
});

describe('calculateLongestStreak', () => {
	it('finds the longest run', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		const logs = [
			log('1', '2024-01-01'),
			log('1', '2024-01-02'),
			log('1', '2024-01-03'),
			log('1', '2024-01-10'),
			log('1', '2024-01-11')
		];
		expect(calculateLongestStreak(h, logs)).toBe(3);
	});

	it('skips non-scheduled days in a weekday habit', () => {
		const h = habit({ id: '1', frequency: 'weekdays' });
		// Thu, Fri, then Mon, Tue — the weekend is skipped.
		const logs = [
			log('1', '2024-01-18'), // Thu
			log('1', '2024-01-19'), // Fri
			log('1', '2024-01-22'), // Mon
			log('1', '2024-01-23') // Tue
		];
		expect(calculateLongestStreak(h, logs)).toBe(4);
	});

	it('ignores completed logs on non-scheduled days', () => {
		const h = habit({ id: '1', frequency: 'weekdays' });
		const logs = [
			log('1', '2024-01-19'), // Fri
			log('1', '2024-01-20'), // Sat (not scheduled)
			log('1', '2024-01-21') // Sun (not scheduled)
		];
		expect(calculateLongestStreak(h, logs)).toBe(1);
	});

	it('returns 0 with no logs', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		expect(calculateLongestStreak(h, [])).toBe(0);
	});
});

describe('calculateCompletionRate', () => {
	it('computes completed / scheduled over the window', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		const logs = [log('1', '2024-01-13'), log('1', '2024-01-14')];
		// Window Mon 15 back 4 days: 11,12,13,14,15 -> 5 scheduled, 2 done = 40%
		expect(calculateCompletionRate(h, logs, '2024-01-11', '2024-01-15')).toBe(40);
	});

	it('returns 0 when nothing is scheduled', () => {
		const h = habit({ id: '1', frequency: 'custom', daysOfWeek: [0] }); // Sundays only
		expect(calculateCompletionRate(h, [], MON, '2024-01-19')).toBe(0);
	});
});

describe('heatLevel', () => {
	const today = '2024-01-15';
	it('is 0 for non-scheduled or future days', () => {
		const h = habit({ id: '1', frequency: 'weekdays' });
		expect(heatLevel(h, new Map(), SAT, today)).toBe(0);
		expect(heatLevel(h, new Map(), '2024-01-20', today)).toBe(0);
	});
	it('is 4 when completed', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		const idx = indexLogs([log('1', today)]);
		expect(heatLevel(h, idx, today, today)).toBe(4);
	});
	it('is 1 when scheduled but not done', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		expect(heatLevel(h, new Map(), today, today)).toBe(1);
	});
	it('uses value/target ratio for partial credit', () => {
		const h = habit({ id: '1', frequency: 'daily', targetPerPeriod: 8 });
		const partial = indexLogs([
			{ id: 'x', habitId: '1', date: today, completed: false, value: 4, updatedAt: 'x' }
		]);
		expect(heatLevel(h, partial, today, today)).toBe(2);
		const high = indexLogs([
			{ id: 'x', habitId: '1', date: today, completed: false, value: 7, updatedAt: 'x' }
		]);
		expect(heatLevel(h, high, today, today)).toBe(3);
	});
});

describe('summarize', () => {
	it('combines current, longest and rate', () => {
		const h = habit({ id: '1', frequency: 'daily' });
		const logs = [log('1', '2024-01-15'), log('1', '2024-01-14')];
		const s = summarize(h, logs, '2024-01-15');
		expect(s.current).toBe(2);
		expect(s.longest).toBe(2);
		expect(s.completionRate).toBeGreaterThan(0);
	});
});
