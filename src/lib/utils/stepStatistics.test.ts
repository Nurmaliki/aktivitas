import { describe, expect, it } from 'vitest';
import type { StepRecord } from '$lib/types/steps';
import {
	computeStepStats,
	estimateCalories,
	estimateDistanceKm,
	getDailyStepStats,
	getMonthlyStepStats,
	getWeeklyStepStats,
	goalProgress
} from '$lib/utils/stepStatistics';

function makeRecord(date: string, steps: number, source: StepRecord['source'] = 'manual'): StepRecord {
	return { date, steps, source, updatedAt: '2024-03-05T08:00:00.000Z' };
}

describe('goalProgress', () => {
	it('returns 0 when the goal is zero (no divide by zero)', () => {
		expect(goalProgress(5000, 0)).toBe(0);
	});

	it('returns 0 for no steps', () => {
		expect(goalProgress(0, 10000)).toBe(0);
	});

	it('returns 50 for half the goal', () => {
		expect(goalProgress(5000, 10000)).toBe(50);
	});

	it('returns 100 exactly at the goal', () => {
		expect(goalProgress(10000, 10000)).toBe(100);
	});

	it('clamps above 100 when the goal is exceeded', () => {
		expect(goalProgress(25000, 10000)).toBe(100);
	});

	it('handles invalid numbers gracefully', () => {
		expect(goalProgress(NaN, 10000)).toBe(0);
		expect(goalProgress(-100, 10000)).toBe(0);
		expect(goalProgress(5000, NaN)).toBe(0);
	});
});

describe('estimateDistanceKm / estimateCalories', () => {
	it('returns 0 for zero/invalid input', () => {
		expect(estimateDistanceKm(0)).toBe(0);
		expect(estimateDistanceKm(-5)).toBe(0);
		expect(estimateCalories(NaN)).toBe(0);
	});

	it('estimates a plausible distance for 10000 steps (~7.6 km)', () => {
		expect(estimateDistanceKm(10000)).toBeCloseTo(7.62, 1);
	});

	it('estimates calories for 10000 steps', () => {
		expect(estimateCalories(10000)).toBe(400);
	});
});

describe('computeStepStats', () => {
	it('returns zeroed stats for an empty list', () => {
		const stats = computeStepStats([]);
		expect(stats.totalSteps).toBe(0);
		expect(stats.days).toBe(0);
		expect(stats.averageSteps).toBe(0);
		expect(stats.bestDaySteps).toBe(0);
		expect(stats.bestDayDate).toBeNull();
	});

	it('handles a single record', () => {
		const stats = computeStepStats([makeRecord('2024-03-05', 8000)]);
		expect(stats.totalSteps).toBe(8000);
		expect(stats.days).toBe(1);
		expect(stats.averageSteps).toBe(8000);
		expect(stats.bestDaySteps).toBe(8000);
		expect(stats.bestDayDate).toBe('2024-03-05');
	});

	it('aggregates multiple days and finds the best day', () => {
		const stats = computeStepStats([
			makeRecord('2024-03-01', 4000),
			makeRecord('2024-03-02', 12000),
			makeRecord('2024-03-03', 7000)
		]);
		expect(stats.totalSteps).toBe(23000);
		expect(stats.days).toBe(3);
		expect(stats.averageSteps).toBe(7667);
		expect(stats.bestDaySteps).toBe(12000);
		expect(stats.bestDayDate).toBe('2024-03-02');
	});

	it('treats negative or invalid step values as zero', () => {
		const stats = computeStepStats([
			makeRecord('2024-03-01', -100),
			makeRecord('2024-03-02', 5000)
		]);
		expect(stats.totalSteps).toBe(5000);
		expect(stats.bestDaySteps).toBe(5000);
	});
});

describe('getDailyStepStats', () => {
	it('fills missing dates with zero and keeps every requested date', () => {
		const records = [makeRecord('2024-03-02', 6000)];
		const days = getDailyStepStats(records, ['2024-03-01', '2024-03-02', '2024-03-03'], 10000);
		expect(days).toHaveLength(3);
		expect(days[0].steps).toBe(0);
		expect(days[1].steps).toBe(6000);
		expect(days[1].goalProgress).toBe(60);
		expect(days[2].steps).toBe(0);
	});
});

describe('getWeeklyStepStats', () => {
	it('returns 7 buckets ending today', () => {
		const days = getWeeklyStepStats([], 7, '2024-03-05');
		expect(days).toHaveLength(7);
		expect(days[6].date).toBe('2024-03-05');
	});

	it('maps records to the correct days and ignores out-of-range data', () => {
		const records = [
			makeRecord('2024-03-05', 9000),
			makeRecord('2024-03-04', 3000),
			makeRecord('2024-01-01', 20000)
		];
		const days = getWeeklyStepStats(records, 7, '2024-03-05');
		const fifth = days.find((day) => day.date === '2024-03-05')!;
		expect(fifth.steps).toBe(9000);
		expect(days.find((day) => day.date === '2024-01-01')).toBeUndefined();
	});

	it('straddles a month change correctly', () => {
		const records = [makeRecord('2024-03-01', 7500)];
		const days = getWeeklyStepStats(records, 7, '2024-03-03');
		expect(days.find((day) => day.date === '2024-03-01')!.steps).toBe(7500);
	});
});

describe('getMonthlyStepStats', () => {
	it('covers the real calendar month (leap February = 29 days)', () => {
		const monthly = getMonthlyStepStats([], '2024-02-10', 10000);
		expect(monthly.daily).toHaveLength(29);
		expect(monthly.monthLabel).toBe('Februari 2024');
	});

	it('separates months and counts goal-met days', () => {
		const records = [
			makeRecord('2024-03-01', 12000), // meets goal
			makeRecord('2024-03-02', 5000), // misses goal
			makeRecord('2024-04-01', 20000) // different month
		];
		const monthly = getMonthlyStepStats(records, '2024-03-15', 10000);
		expect(monthly.stats.totalSteps).toBe(17000);
		expect(monthly.activeDays).toBe(2);
		expect(monthly.daysGoalMet).toBe(1);
		expect(monthly.goal).toBe(10000);
	});

	it('returns zeroed aggregates for an empty month', () => {
		const monthly = getMonthlyStepStats([], '2024-03-15', 10000);
		expect(monthly.stats.totalSteps).toBe(0);
		expect(monthly.activeDays).toBe(0);
		expect(monthly.daysGoalMet).toBe(0);
	});
});
