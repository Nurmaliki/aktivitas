import type { AppSettings, StepRecord } from '$lib/types/steps';

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

export interface Activity {
	id: string;
	name: string;
	description?: string;
	category: ActivityCategory;
	/** Local date string in YYYY-MM-DD format */
	date: string;
	/** Duration in minutes */
	duration: number;
	completed: boolean;
	/** ISO timestamp */
	createdAt: string;
	/** ISO timestamp */
	updatedAt: string;
}

/** Payload used when creating a new activity (id/timestamps are generated). */
export interface ActivityInput {
	name: string;
	description?: string;
	category: ActivityCategory;
	date: string;
	duration: number;
	completed: boolean;
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
