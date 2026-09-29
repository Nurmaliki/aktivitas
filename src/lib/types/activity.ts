import type { AppSettings, StepRecord } from '$lib/types/steps';
import type {
	ActivityStatus,
	Priority,
	RecurrenceRule,
	ReminderConfig,
	Subtask,
	SyncMetadata
} from '$lib/types/common';

export type ActivityCategory =
	| 'Development'
	| 'Meeting'
	| 'Learning'
	| 'Exercise'
	| 'Personal'
	| 'Other';

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
	'Development',
	'Meeting',
	'Learning',
	'Exercise',
	'Personal',
	'Other'
];

/**
 * Activity record.
 *
 * v3 added scheduling/focus fields. Every new field is optional so that legacy
 * records (v1/v2: only id/name/category/date/duration/completed/timestamps)
 * remain valid. The normalization layer fills sensible defaults on read.
 */
export interface Activity {
	id: string;
	name: string;
	description?: string;
	category: ActivityCategory;
	/** Optional explicit category id (mirrors `category` for forward-compat). */
	categoryId?: string;
	/** Local date string in YYYY-MM-DD format */
	date: string;
	/** Duration in minutes (legacy field; kept for backward compatibility). */
	duration: number;
	/** v3: planned duration. Defaults to `duration` when absent. */
	plannedDuration?: number;
	/** v3: actual focused/worked duration in minutes. */
	actualDuration?: number;
	/** v3: local start time "HH:MM". */
	startTime?: string;
	/** v3: local end time "HH:MM". */
	endTime?: string;
	completed: boolean;
	/** v3: lifecycle status. Derived from `completed` when absent. */
	status?: ActivityStatus;
	/** v3: priority. */
	priority?: Priority;
	/** v3: reminder configuration. */
	reminder?: ReminderConfig;
	/** v3: recurrence rule. */
	recurrence?: RecurrenceRule;
	/** v3: checklist. Defaults to [] when absent. */
	subtasks?: Subtask[];
	/** v3: link to a habit. */
	habitId?: string;
	/** ISO timestamp */
	createdAt: string;
	/** ISO timestamp */
	updatedAt: string;
	/** v3: ISO timestamp when completed. */
	completedAt?: string;
	/** v3: last snooze ISO timestamp. */
	snoozedUntil?: string;
	/** v3: sync bookkeeping. */
	syncMeta?: SyncMetadata;
}

/** Payload used when creating a new activity (id/timestamps are generated). */
export interface ActivityInput {
	name: string;
	description?: string;
	category: ActivityCategory;
	date: string;
	duration: number;
	completed: boolean;
	/** v3 optional scheduling fields. */
	startTime?: string;
	endTime?: string;
	plannedDuration?: number;
	priority?: Priority;
	status?: ActivityStatus;
	reminder?: ReminderConfig;
	recurrence?: RecurrenceRule;
	subtasks?: Subtask[];
	habitId?: string;
}

/** Result of a validation pass over an activity input. */
export interface ValidationResult {
	valid: boolean;
	errors: Partial<Record<keyof ActivityInput, string>>;
}

/** Shape of an exported backup file. */
export interface BackupFile {
	version: number;
	exportedAt: string;
	activities: Activity[];
	/** v2+: optional step records. */
	steps?: StepRecord[];
	/** v2+: optional app settings (e.g. step goal). */
	settings?: AppSettings;
}

export const BACKUP_VERSION = 2;

/** Hard limits to keep inputs reasonable and avoid pathological data. */
export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_DURATION_MINUTES = 24 * 60;
