import { BACKUP_VERSION, type Activity, type BackupFile } from '$lib/types/activity';
import { DEFAULT_SETTINGS, type AppSettings, type StepRecord } from '$lib/types/steps';
import { isValidActivity } from '$lib/utils/validation';
import { isValidStepRecord, clampStepGoal } from '$lib/services/db';
import { getLocalDateString } from '$lib/utils/date';
import {
	getActivities,
	getSettings,
	getStepRecords,
	mergeActivities,
	mergeStepRecords,
	putSettings,
	replaceActivities,
	replaceStepRecords
} from '$lib/services/db';

export interface BackupValidationResult {
	valid: boolean;
	/** Human-readable error message when invalid. */
	error?: string;
	activities: Activity[];
	steps: StepRecord[];
	settings: AppSettings;
	/** Backward-compatible flag: true when the steps section was present. */
	hasSteps: boolean;
}

/** Build a backup object from the current data. */
export function createBackup(
	activities: Activity[],
	steps: StepRecord[] = [],
	settings: AppSettings = { ...DEFAULT_SETTINGS }
): BackupFile {
	return {
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		activities,
		steps,
		settings
	};
}

/** Default backup filename: daily-activity-backup-YYYY-MM-DD.json */
export function backupFileName(date: string = getLocalDateString()): string {
	return `daily-activity-backup-${date}.json`;
}

/**
 * Validate an arbitrary parsed JSON value as a backup file.
 * We never trust the file contents: structure, version and every record are
 * checked before anything touches IndexedDB.
 *
 * v1 files contain only `activities`; v2+ may also contain `steps`/`settings`.
 */
export function validateBackup(data: unknown): BackupValidationResult {
	const fail = (error: string): BackupValidationResult => ({
		valid: false,
		error,
		activities: [],
		steps: [],
		settings: { ...DEFAULT_SETTINGS },
		hasSteps: false
	});

	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return fail('Struktur file tidak valid: root harus berupa objek JSON.');
	}

	const record = data as Record<string, unknown>;

	if (typeof record.version !== 'number' || !Number.isInteger(record.version)) {
		return fail('File tidak memiliki nomor versi yang valid.');
	}
	if (record.version < 1) {
		return fail('Nomor versi backup tidak valid.');
	}
	if (record.version > BACKUP_VERSION) {
		return fail(
			`Versi backup (${record.version}) tidak didukung. Versi maksimum: ${BACKUP_VERSION}.`
		);
	}
	if (!Array.isArray(record.activities)) {
		return fail('File tidak memiliki daftar aktivitas (activities).');
	}

	const activities: Activity[] = [];
	for (let i = 0; i < record.activities.length; i++) {
		const item = record.activities[i];
		if (!isValidActivity(item)) {
			return fail(`Aktivitas pada indeks ${i} tidak valid atau rusak.`);
		}
		activities.push(item);
	}

	// Steps are optional (absent in v1 files).
	const steps: StepRecord[] = [];
	let hasSteps = false;
	if (record.steps != null) {
		if (!Array.isArray(record.steps)) {
			return fail('Bagian "steps" harus berupa daftar.');
		}
		for (let i = 0; i < record.steps.length; i++) {
			const item = record.steps[i];
			if (!isValidStepRecord(item)) {
				return fail(`Data langkah pada indeks ${i} tidak valid atau rusak.`);
			}
			steps.push(item);
		}
		hasSteps = true;
	}

	// Settings are optional too.
	const settings: AppSettings = { ...DEFAULT_SETTINGS };
	if (record.settings != null) {
		if (typeof record.settings !== 'object' || Array.isArray(record.settings)) {
			return fail('Bagian "settings" harus berupa objek.');
		}
		const rawSettings = record.settings as Record<string, unknown>;
		if (rawSettings.stepGoal != null) {
			if (typeof rawSettings.stepGoal !== 'number' || !Number.isFinite(rawSettings.stepGoal)) {
				return fail('Nilai "stepGoal" pada settings tidak valid.');
			}
			settings.stepGoal = clampStepGoal(rawSettings.stepGoal);
		}
	}

	return { valid: true, activities, steps, settings, hasSteps };
}

/** Parse raw file text into a validated backup. */
export function parseBackupText(text: string): BackupValidationResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return {
			valid: false,
			error: 'File bukan JSON yang valid.',
			activities: [],
			steps: [],
			settings: { ...DEFAULT_SETTINGS },
			hasSteps: false
		};
	}
	return validateBackup(parsed);
}

/** Trigger a JSON file download in the browser. */
function downloadJson(json: string, filename: string): void {
	if (typeof document === 'undefined' || typeof URL === 'undefined') {
		throw new Error('Export hanya dapat dilakukan di browser.');
	}
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	try {
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.rel = 'noopener';
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}
}

export interface ExportSummary {
	activities: number;
	steps: number;
}

/**
 * Export the current database (activities + steps + settings) to JSON.
 */
export async function exportData(): Promise<ExportSummary> {
	const [activities, steps, settings] = await Promise.all([
		getActivities(),
		getStepRecords(),
		getSettings()
	]);
	const backup = createBackup(activities, steps, settings);
	downloadJson(JSON.stringify(backup, null, 2), backupFileName());
	return { activities: activities.length, steps: steps.length };
}

export interface ImportResult {
	mode: 'merge' | 'replace';
	activities: number;
	steps: number;
}

/**
 * Import validated backup data with the chosen strategy.
 * - "replace": wipe existing data, then insert everything from the backup.
 * - "merge": keep existing data, add missing activities and raise step totals.
 */
export async function importData(
	backup: Pick<BackupValidationResult, 'activities' | 'steps' | 'settings'>,
	mode: 'merge' | 'replace'
): Promise<ImportResult> {
	if (mode === 'replace') {
		await replaceActivities(backup.activities);
		await replaceStepRecords(backup.steps);
		if (backup.settings) await putSettings(backup.settings);
		return { mode, activities: backup.activities.length, steps: backup.steps.length };
	}

	const addedActivities = await mergeActivities(backup.activities);
	await mergeStepRecords(backup.steps);
	if (backup.settings) await putSettings(backup.settings);
	return { mode, activities: addedActivities, steps: backup.steps.length };
}
