import {
	BACKUP_VERSION,
	type Activity,
	type BackupFile
} from '$lib/types/activity';
import { isValidActivity } from '$lib/utils/validation';
import { getLocalDateString } from '$lib/utils/date';
import { getActivities, mergeActivities, replaceActivities } from '$lib/services/db';

export interface BackupValidationResult {
	valid: boolean;
	/** Human-readable error message when invalid. */
	error?: string;
	activities: Activity[];
}

/** Build a backup object from a list of activities. */
export function createBackup(activities: Activity[]): BackupFile {
	return {
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		activities
	};
}

/** Default backup filename: daily-activity-backup-YYYY-MM-DD.json */
export function backupFileName(date: string = getLocalDateString()): string {
	return `daily-activity-backup-${date}.json`;
}

/**
 * Validate an arbitrary parsed JSON value as a backup file.
 * We never trust the file contents: structure, version and every activity are
 * checked before anything touches IndexedDB.
 */
export function validateBackup(data: unknown): BackupValidationResult {
	const fail = (error: string): BackupValidationResult => ({
		valid: false,
		error,
		activities: []
	});

	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		return fail('Struktur file tidak valid: root harus berupa objek JSON.');
	}

	const record = data as Record<string, unknown>;

	if (typeof record.version !== 'number' || !Number.isInteger(record.version)) {
		return fail('File tidak memiliki nomor versi yang valid.');
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

	return { valid: true, activities };
}

/** Parse raw file text into a validated backup. */
export function parseBackupText(text: string): BackupValidationResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { valid: false, error: 'File bukan JSON yang valid.', activities: [] };
	}
	return validateBackup(parsed);
}

/**
 * Export the current database to a JSON download.
 * Returns the number of activities exported, or 0 in non-browser contexts.
 */
export async function exportData(): Promise<number> {
	const activities = await getActivities();
	const backup = createBackup(activities);
	const json = JSON.stringify(backup, null, 2);

	if (typeof document === 'undefined' || typeof URL === 'undefined') {
		throw new Error('Export hanya dapat dilakukan di browser.');
	}

	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	try {
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = backupFileName();
		anchor.rel = 'noopener';
		document.body.appendChild(anchor);
		anchor.click();
		document.body.removeChild(anchor);
	} finally {
		// Release the object URL on the next tick so the download can start.
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	return activities.length;
}

export interface ImportResult {
	mode: 'merge' | 'replace';
	imported: number;
}

/**
 * Import a validated backup with the chosen strategy.
 * - "replace": wipe existing data, then insert everything from the backup.
 * - "merge": keep existing data, add only activities whose id is not present.
 */
export async function importData(
	activities: Activity[],
	mode: 'merge' | 'replace'
): Promise<ImportResult> {
	if (mode === 'replace') {
		await replaceActivities(activities);
		return { mode, imported: activities.length };
	}
	const imported = await mergeActivities(activities);
	return { mode, imported };
}
