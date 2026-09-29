import type { StepRecord, StepStats, DailyStepStats } from '$lib/types/steps';
import { CALORIES_PER_STEP, STEP_STRIDE_METERS } from '$lib/types/steps';
import {
	getDateRange,
	getLastNDays,
	getMonthDates,
	getWeekdayShort,
	formatMonthLabel
} from '$lib/utils/date';

/**
 * Progress toward a goal as a clamped integer percentage.
 * Never divides by zero.
 */
export function goalProgress(steps: number, goal: number): number {
	if (goal <= 0 || !Number.isFinite(goal)) return 0;
	const safeSteps = Number.isFinite(steps) && steps > 0 ? steps : 0;
	return Math.max(0, Math.min(100, Math.round((safeSteps / goal) * 100)));
}

/** Estimate distance in kilometres from a step count. */
export function estimateDistanceKm(steps: number): number {
	if (!Number.isFinite(steps) || steps <= 0) return 0;
	return Math.round(((steps * STEP_STRIDE_METERS) / 1000) * 100) / 100;
}

/** Estimate calories burned from a step count. */
export function estimateCalories(steps: number): number {
	if (!Number.isFinite(steps) || steps <= 0) return 0;
	return Math.round(steps * CALORIES_PER_STEP);
}

/**
 * Aggregate step statistics over a flat list of records.
 * Pure function so it can be unit-tested without IndexedDB.
 */
export function computeStepStats(records: StepRecord[]): StepStats {
	if (records.length === 0) {
		return {
			totalSteps: 0,
			days: 0,
			averageSteps: 0,
			bestDaySteps: 0,
			bestDayDate: null,
			totalCalories: 0,
			totalDistanceKm: 0
		};
	}

	let totalSteps = 0;
	let bestDaySteps = 0;
	let bestDayDate: string | null = null;

	for (const record of records) {
		const steps = Number.isFinite(record.steps) && record.steps > 0 ? record.steps : 0;
		totalSteps += steps;
		if (steps > bestDaySteps) {
			bestDaySteps = steps;
			bestDayDate = record.date;
		}
	}

	return {
		totalSteps,
		days: records.length,
		averageSteps: Math.round(totalSteps / records.length),
		bestDaySteps,
		bestDayDate,
		totalCalories: estimateCalories(totalSteps),
		totalDistanceKm: estimateDistanceKm(totalSteps)
	};
}

/** Map of date -> steps, for O(1) lookups while aggregating. */
function toStepsByDate(records: StepRecord[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const record of records) {
		const steps = Number.isFinite(record.steps) && record.steps > 0 ? record.steps : 0;
		map.set(record.date, steps);
	}
	return map;
}

/**
 * Per-day step data for an explicit list of local dates (missing days = 0).
 * Keeps the x-axis stable even when no records exist for a day.
 */
export function getDailyStepStats(
	records: StepRecord[],
	dates: string[],
	goal: number
): DailyStepStats[] {
	const byDate = toStepsByDate(records);
	return dates.map((date) => {
		const steps = byDate.get(date) ?? 0;
		return {
			date,
			label: getWeekdayShort(date),
			steps,
			goalProgress: goalProgress(steps, goal)
		};
	});
}

/** Per-day step data for the last `days` days ending today. */
export function getWeeklyStepStats(
	records: StepRecord[],
	days = 7,
	today?: string
): DailyStepStats[] {
	return getDailyStepStats(records, getLastNDays(days, today), 0);
}

/** Month-to-date step summary + per-day breakdown. */
export interface MonthlyStepStats {
	monthLabel: string;
	stats: StepStats;
	goal: number;
	daily: DailyStepStats[];
	/** Number of days in the month that met the goal. */
	daysGoalMet: number;
	/** Days with any steps recorded. */
	activeDays: number;
}

export function getMonthlyStepStats(
	records: StepRecord[],
	referenceDate: string,
	goal: number
): MonthlyStepStats {
	const monthDates = getMonthDates(referenceDate);
	const dateSet = new Set(monthDates);
	const monthRecords = records.filter((record) => dateSet.has(record.date));

	const byDate = toStepsByDate(monthRecords);
	const daily = monthDates.map((date) => {
		const steps = byDate.get(date) ?? 0;
		return {
			date,
			label: String(Number(date.slice(8, 10))),
			steps,
			goalProgress: goalProgress(steps, goal)
		};
	});

	return {
		monthLabel: formatMonthLabel(referenceDate),
		stats: computeStepStats(monthRecords),
		goal,
		daily,
		daysGoalMet: daily.filter((day) => goal > 0 && day.steps >= goal).length,
		activeDays: daily.filter((day) => day.steps > 0).length
	};
}

/** Number of dates in the inclusive range (used by the weekly trend). */
export function countRangeDays(start: string, end: string): number {
	return getDateRange(start, end).length;
}
