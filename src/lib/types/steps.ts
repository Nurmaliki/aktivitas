/**
 * Step counter types.
 *
 * Data is stored as one record per local date (keyPath: `date`), so a day has
 * a single, authoritative step total regardless of how many times the sensor
 * flushes or the user edits it manually.
 */

export type StepSource = 'sensor' | 'manual' | 'import';

export interface StepRecord {
	/** Local date string, YYYY-MM-DD. Primary key. */
	date: string;
	/** Total steps recorded for the day. */
	steps: number;
	/** Where the value came from (last writer wins on merge). */
	source: StepSource;
	/** ISO timestamp of the last update. */
	updatedAt: string;
}

export interface AppSettings {
	/** Daily step goal. */
	stepGoal: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
	stepGoal: 10000
};

export const MIN_STEP_GOAL = 1000;
export const MAX_STEP_GOAL = 100000;
/** A day can't realistically exceed this many steps; guards bad imports/typos. */
export const MAX_STEPS_PER_DAY = 200000;

/** Aggregate step statistics for a set of records. */
export interface StepStats {
	totalSteps: number;
	/** Number of days that have a record (even if 0 steps). */
	days: number;
	/** Average steps across the recorded days (0 when there are none). */
	averageSteps: number;
	bestDaySteps: number;
	/** Local date of the best day, or null. */
	bestDayDate: string | null;
	totalCalories: number;
	totalDistanceKm: number;
}

export interface DailyStepStats {
	date: string;
	label: string;
	steps: number;
	/** 0-100 progress toward the goal; clamped. */
	goalProgress: number;
}

/** Rough conversion constants (documented as estimates, not medical advice). */
/** Average stride length used to estimate distance. */
export const STEP_STRIDE_METERS = 0.762;
/** Approx. kilocalories burned per step for an average adult. */
export const CALORIES_PER_STEP = 0.04;
