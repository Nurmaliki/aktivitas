/**
 * Shared primitive types used across domains (activity, habit, focus, sync).
 */

export type Priority = 'low' | 'medium' | 'high';

/**
 * Lifecycle status for a scheduled activity.
 *
 * Backward compatibility: legacy records only had `completed: boolean`.
 * The normalization layer derives `status` from `completed` and, for records
 * that are still `planned` and in the past, re-derives `missed` on read.
 */
export type ActivityStatus =
	| 'planned'
	| 'running'
	| 'paused'
	| 'completed'
	| 'skipped'
	| 'missed'
	| 'cancelled';

export const ACTIVITY_STATUSES: ActivityStatus[] = [
	'planned',
	'running',
	'paused',
	'completed',
	'skipped',
	'missed',
	'cancelled'
];

export type RecurrenceFrequency =
	| 'none'
	| 'daily'
	| 'weekdays'
	| 'weekly'
	| 'monthly'
	| 'custom';

export interface RecurrenceRule {
	frequency: RecurrenceFrequency;
	/** Every N periods (e.g. interval 2 + weekly = every 2 weeks). */
	interval?: number;
	/** 0 = Sunday .. 6 = Saturday. Used for 'custom' / 'weekly'. */
	daysOfWeek?: number[];
	/** Inclusive last date (local YYYY-MM-DD) the rule applies to. */
	endDate?: string;
}

export interface ReminderConfig {
	enabled: boolean;
	/** Local time "HH:MM" to fire at, when set directly. */
	time?: string;
	/** Fire this many minutes before the activity start time. */
	minutesBefore?: number;
	sound: boolean;
	vibration: boolean;
	snoozeMinutes: number;
	repeat?: RecurrenceRule;
}

export interface Subtask {
	id: string;
	title: string;
	completed: boolean;
	order: number;
	createdAt: string;
	completedAt?: string;
}

/**
 * Sync metadata attached to records that participate in multi-device sync.
 * Local-only mode simply leaves `syncStatus` at 'local'.
 */
export interface SyncMetadata {
	updatedAt: string;
	/** Soft-delete tombstone so deletions can be propagated. */
	deletedAt?: string;
	syncStatus?: 'local' | 'pending' | 'synced' | 'conflict';
}

export const DEFAULT_PRIORITY: Priority = 'medium';
export const DEFAULT_SNOOZE_MINUTES = 5;
export const SNOOZE_OPTIONS = [5, 10, 15, 30] as const;
export const DEFAULT_REMINDER: ReminderConfig = {
	enabled: false,
	sound: true,
	vibration: true,
	snoozeMinutes: DEFAULT_SNOOZE_MINUTES
};
