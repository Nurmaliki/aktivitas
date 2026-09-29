import { describe, expect, it } from 'vitest';
import type { Activity } from '$lib/types/activity';
import { BACKUP_VERSION } from '$lib/types/activity';
import {
	backupFileName,
	createBackup,
	parseBackupText,
	validateBackup
} from '$lib/services/backup';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
	return {
		id: 'abc-123',
		name: 'Test activity',
		category: 'Development',
		date: '2024-03-05',
		duration: 30,
		completed: false,
		createdAt: '2024-03-05T08:00:00.000Z',
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

describe('createBackup', () => {
	it('wraps activities with version and timestamp', () => {
		const backup = createBackup([makeActivity()]);
		expect(backup.version).toBe(BACKUP_VERSION);
		expect(backup.activities).toHaveLength(1);
		expect(typeof backup.exportedAt).toBe('string');
		expect(new Date(backup.exportedAt).toString()).not.toBe('Invalid Date');
	});
});

describe('backupFileName', () => {
	it('uses the daily-activity-backup-YYYY-MM-DD.json pattern', () => {
		expect(backupFileName('2024-03-05')).toBe('daily-activity-backup-2024-03-05.json');
	});
});

describe('validateBackup', () => {
	it('accepts a valid backup', () => {
		const result = validateBackup({ version: 1, exportedAt: 'x', activities: [makeActivity()] });
		expect(result.valid).toBe(true);
		expect(result.activities).toHaveLength(1);
	});

	it('accepts an empty activity list', () => {
		const result = validateBackup({ version: 1, activities: [] });
		expect(result.valid).toBe(true);
		expect(result.activities).toEqual([]);
	});

	it('rejects non-object roots', () => {
		expect(validateBackup(null).valid).toBe(false);
		expect(validateBackup('string').valid).toBe(false);
		expect(validateBackup([]).valid).toBe(false);
		expect(validateBackup(42).valid).toBe(false);
	});

	it('rejects a missing or non-numeric version', () => {
		expect(validateBackup({ activities: [] }).valid).toBe(false);
		expect(validateBackup({ version: 'one', activities: [] }).valid).toBe(false);
	});

	it('rejects an unsupported (too new) version', () => {
		const result = validateBackup({ version: 99, activities: [] });
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/versi/i);
	});

	it('rejects a missing activities array', () => {
		expect(validateBackup({ version: 1 }).valid).toBe(false);
		expect(validateBackup({ version: 1, activities: 'nope' }).valid).toBe(false);
	});

	it('rejects a backup containing an invalid activity', () => {
		const result = validateBackup({
			version: 1,
			activities: [makeActivity(), { id: 'bad' }]
		});
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/indeks 1/i);
	});
});

describe('parseBackupText', () => {
	it('parses and validates a well-formed JSON backup', () => {
		const json = JSON.stringify({ version: 1, exportedAt: 'x', activities: [makeActivity()] });
		const result = parseBackupText(json);
		expect(result.valid).toBe(true);
		expect(result.activities).toHaveLength(1);
	});

	it('rejects invalid JSON without throwing', () => {
		const result = parseBackupText('{ not json ');
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/json/i);
	});

	it('rejects an empty string', () => {
		expect(parseBackupText('').valid).toBe(false);
	});

	it('rejects valid JSON that is not a valid backup', () => {
		const result = parseBackupText(JSON.stringify([1, 2, 3]));
		expect(result.valid).toBe(false);
	});
});
