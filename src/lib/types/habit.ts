import type { ReminderConfig } from '$lib/types/common';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'custom';

export interface Habit {
	id: string;
	name: string;
	description?: string;
	/** Reuses the activity category list (stored as the category name). */
	categoryId?: string;
	frequency: HabitFrequency;
	/** 0 = Sunday .. 6 = Saturday. Used by 'custom' / 'weekly'. */
	daysOfWeek?: number[];
	/** How many completions are expected per period (usually 1/day). */
	targetPerPeriod: number;
	reminder?: ReminderConfig;
	active: boolean;
	createdAt: string;
	updatedAt: string;
	/** Sync bookkeeping. */
	deletedAt?: string;
	syncStatus?: 'local' | 'pending' | 'synced' | 'conflict';
}

/**
 * Explicit per-day habit log.
 *
 * Streaks are computed from logs (not from activities), so a habit can exist
 * without ever creating a corresponding Activity record.
 */
export interface HabitLog {
	id: string;
	habitId: string;
	/** Local date string YYYY-MM-DD. */
	date: string;
	completed: boolean;
	/** Optional measured value (e.g. glasses of water). */
	value?: number;
	completedAt?: string;
	updatedAt: string;
	deletedAt?: string;
	syncStatus?: 'local' | 'pending' | 'synced' | 'conflict';
}

export interface HabitInput {
	name: string;
	description?: string;
	categoryId?: string;
	frequency: HabitFrequency;
	daysOfWeek?: number[];
	targetPerPeriod: number;
	reminder?: ReminderConfig;
	active: boolean;
}

export const DEFAULT_HABIT: Omit<Habit, 'id' | 'createdAt' | 'updatedAt'> = {
	name: '',
	frequency: 'daily',
	targetPerPeriod: 1,
	active: true
};

/** Streak summary for a single habit. */
export interface StreakSummary {
	/** Consecutive scheduled periods completed up to the most recent one. */
	current: number;
	/** Longest run of consecutive scheduled-period completions ever. */
	longest: number;
	/** completed / scheduled over the evaluated window (0-100, rounded). */
	completionRate: number;
}

export const HABIT_FREQUENCIES: HabitFrequency[] = ['daily', 'weekdays', 'weekly', 'custom'];
