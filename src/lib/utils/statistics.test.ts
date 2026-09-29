import { describe, expect, it } from 'vitest';
import type { Activity, ActivityCategory } from '$lib/types/activity';
import {
	completionRate,
	computeStats,
	formatDuration,
	getCategoryStats,
	getDailyStats,
	getMonthlyStats,
	getWeeklyStats
} from '$lib/utils/statistics';

let seq = 0;
function makeActivity(overrides: Partial<Activity> = {}): Activity {
	seq += 1;
	return {
		id: `id-${seq}`,
		name: `Activity ${seq}`,
		category: 'Development' as ActivityCategory,
		date: '2024-03-05',
		duration: 30,
		completed: false,
		createdAt: `2024-03-05T08:00:${String(seq).padStart(2, '0')}.000Z`,
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

describe('completionRate', () => {
	it('returns 0 when there are no activities (no divide by zero)', () => {
		expect(completionRate(0, 0)).toBe(0);
	});

	it('computes and rounds a percentage', () => {
		expect(completionRate(8, 6)).toBe(75);
		expect(completionRate(3, 1)).toBe(33);
	});

	it('returns 100 when everything is complete', () => {
		expect(completionRate(5, 5)).toBe(100);
	});
});

describe('computeStats', () => {
	it('handles an empty list', () => {
		const stats = computeStats([]);
		expect(stats).toEqual({
			total: 0,
			completed: 0,
			pending: 0,
			completionRate: 0,
			totalDuration: 0,
			completedDuration: 0,
			averageDuration: 0
		});
	});

	it('handles a single activity', () => {
		const stats = computeStats([makeActivity({ duration: 45, completed: true })]);
		expect(stats.total).toBe(1);
		expect(stats.completed).toBe(1);
		expect(stats.pending).toBe(0);
		expect(stats.completionRate).toBe(100);
		expect(stats.totalDuration).toBe(45);
	});

	it('handles all completed', () => {
		const activities = [
			makeActivity({ completed: true, duration: 30 }),
			makeActivity({ completed: true, duration: 60 })
		];
		const stats = computeStats(activities);
		expect(stats.completed).toBe(2);
		expect(stats.completionRate).toBe(100);
		expect(stats.completedDuration).toBe(90);
	});

	it('handles none completed', () => {
		const activities = [makeActivity(), makeActivity()];
		const stats = computeStats(activities);
		expect(stats.completed).toBe(0);
		expect(stats.pending).toBe(2);
		expect(stats.completionRate).toBe(0);
		expect(stats.completedDuration).toBe(0);
	});

	it('sums total duration and computes the average', () => {
		const activities = [
			makeActivity({ duration: 30 }),
			makeActivity({ duration: 60 }),
			makeActivity({ duration: 90 })
		];
		const stats = computeStats(activities);
		expect(stats.totalDuration).toBe(180);
		expect(stats.averageDuration).toBe(60);
	});
});

describe('getDailyStats', () => {
	it('only counts activities on the requested date', () => {
		const activities = [
			makeActivity({ date: '2024-03-05', completed: true }),
			makeActivity({ date: '2024-03-05' }),
			makeActivity({ date: '2024-03-06' })
		];
		const stats = getDailyStats(activities, '2024-03-05');
		expect(stats.total).toBe(2);
		expect(stats.completed).toBe(1);
		expect(stats.completionRate).toBe(50);
	});

	it('returns zeroed stats for a date with no activities', () => {
		const stats = getDailyStats([makeActivity({ date: '2024-03-05' })], '2024-03-01');
		expect(stats.total).toBe(0);
		expect(stats.completionRate).toBe(0);
	});
});

describe('getWeeklyStats', () => {
	it('returns exactly 7 buckets ending today, in chronological order', () => {
		const days = getWeeklyStats([], 7, '2024-03-05');
		expect(days).toHaveLength(7);
		expect(days[0].date).toBe('2024-02-28');
		expect(days[6].date).toBe('2024-03-05');
	});

	it('aggregates activities into the correct day buckets using real dates', () => {
		const activities = [
			makeActivity({ date: '2024-03-05', duration: 30, completed: true }),
			makeActivity({ date: '2024-03-05', duration: 30 }),
			makeActivity({ date: '2024-03-04', duration: 60, completed: true }),
			// Outside the 7-day window — must be ignored.
			makeActivity({ date: '2024-01-01', duration: 999, completed: true })
		];
		const days = getWeeklyStats(activities, 7, '2024-03-05');
		const fifth = days.find((day) => day.date === '2024-03-05')!;
		const fourth = days.find((day) => day.date === '2024-03-04')!;
		const outside = days.find((day) => day.date === '2024-01-01');

		expect(fifth.total).toBe(2);
		expect(fifth.completed).toBe(1);
		expect(fifth.totalDuration).toBe(60);
		expect(fifth.completionRate).toBe(50);

		expect(fourth.total).toBe(1);
		expect(fourth.totalDuration).toBe(60);
		expect(outside).toBeUndefined();
	});

	it('straddles a month change correctly', () => {
		const activities = [makeActivity({ date: '2024-03-01', duration: 45, completed: true })];
		const days = getWeeklyStats(activities, 7, '2024-03-03');
		const first = days.find((day) => day.date === '2024-03-01')!;
		expect(first.total).toBe(1);
		expect(first.totalDuration).toBe(45);
		expect(first.label).toBe('Jum');
	});
});

describe('getCategoryStats', () => {
	it('aggregates counts and duration-weighted percentages', () => {
		const activities = [
			makeActivity({ category: 'Development', duration: 45 }),
			makeActivity({ category: 'Learning', duration: 25 }),
			makeActivity({ category: 'Meeting', duration: 15 }),
			makeActivity({ category: 'Exercise', duration: 10 }),
			makeActivity({ category: 'Other', duration: 5 })
		];
		const stats = getCategoryStats(activities);
		const dev = stats.find((entry) => entry.category === 'Development')!;
		expect(dev.total).toBe(1);
		expect(dev.totalDuration).toBe(45);
		expect(dev.percentage).toBe(45);
	});

	it('returns an empty list when there are no activities', () => {
		expect(getCategoryStats([])).toEqual([]);
	});

	it('sorts categories by total duration descending', () => {
		const activities = [
			makeActivity({ category: 'Other', duration: 10 }),
			makeActivity({ category: 'Development', duration: 100 })
		];
		const stats = getCategoryStats(activities);
		expect(stats[0].category).toBe('Development');
	});
});

describe('getMonthlyStats', () => {
	it('separates activities belonging to different months', () => {
		const activities = [
			makeActivity({ date: '2024-03-05', duration: 30, completed: true }),
			makeActivity({ date: '2024-03-20', duration: 30 }),
			makeActivity({ date: '2024-04-01', duration: 60, completed: true })
		];
		const monthly = getMonthlyStats(activities, '2024-03-15');
		expect(monthly.stats.total).toBe(2);
		expect(monthly.stats.completed).toBe(1);
		expect(monthly.monthLabel).toBe('Maret 2024');
	});

	it('uses real calendar days for the month chart', () => {
		const monthly = getMonthlyStats([], '2024-02-10');
		expect(monthly.daily).toHaveLength(29); // leap year
		expect(monthly.daily[0].date).toBe('2024-02-01');
		expect(monthly.daily[28].date).toBe('2024-02-29');
	});

	it('computes average activities per active day', () => {
		const activities = [
			makeActivity({ date: '2024-03-01' }),
			makeActivity({ date: '2024-03-01' }),
			makeActivity({ date: '2024-03-02' })
		];
		const monthly = getMonthlyStats(activities, '2024-03-15');
		// 3 activities over 2 active days = 1.5
		expect(monthly.averageActivitiesPerDay).toBe(1.5);
	});

	it('identifies the top category and reports averages', () => {
		const activities = [
			makeActivity({ date: '2024-03-01', category: 'Learning', duration: 120 }),
			makeActivity({ date: '2024-03-02', category: 'Meeting', duration: 30 })
		];
		const monthly = getMonthlyStats(activities, '2024-03-15');
		expect(monthly.topCategory).toBe('Learning');
		expect(monthly.averageDurationPerActivity).toBe(75);
	});

	it('returns null top category and zero averages for an empty month', () => {
		const monthly = getMonthlyStats([], '2024-03-15');
		expect(monthly.topCategory).toBeNull();
		expect(monthly.averageActivitiesPerDay).toBe(0);
		expect(monthly.stats.total).toBe(0);
	});
});

describe('formatDuration (re-used from statistics)', () => {
	it('formats common values', () => {
		expect(formatDuration(30)).toBe('30m');
		expect(formatDuration(60)).toBe('1j');
		expect(formatDuration(90)).toBe('1j 30m');
	});
});
