import { describe, expect, it } from 'vitest';
import type { Activity } from '$lib/types/activity';
import type { StepRecord } from '$lib/types/steps';
import type { Habit, HabitLog } from '$lib/types/habit';
import type { FocusSession } from '$lib/types/focus';
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

// ---------------------------------------------------------------------------
// v2: step + settings support (with backward compatibility for v1 files)
// ---------------------------------------------------------------------------

function makeStep(overrides: Partial<StepRecord> = {}): StepRecord {
	return {
		date: '2024-03-05',
		steps: 8000,
		source: 'manual',
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

/** Build a deliberately malformed step record for validation tests. */
function makeRawStep(overrides: Record<string, unknown>): Record<string, unknown> {
	return { ...makeStep(), ...overrides };
}

describe('createBackup (v2)', () => {
	it('includes steps and settings', () => {
		const backup = createBackup([makeActivity()], [makeStep()], { stepGoal: 12000 });
		expect(backup.version).toBe(BACKUP_VERSION);
		expect(backup.steps).toHaveLength(1);
		expect(backup.settings?.stepGoal).toBe(12000);
	});

	it('defaults steps/settings when omitted', () => {
		const backup = createBackup([makeActivity()]);
		expect(backup.steps).toEqual([]);
		expect(backup.settings).toEqual({ stepGoal: 10000 });
	});
});

describe('validateBackup (v1 backward compatibility)', () => {
	it('accepts a v1 file without steps/settings', () => {
		const result = validateBackup({ version: 1, activities: [makeActivity()] });
		expect(result.valid).toBe(true);
		expect(result.steps).toEqual([]);
		expect(result.hasSteps).toBe(false);
		expect(result.settings.stepGoal).toBe(10000);
	});
});

describe('validateBackup (v2)', () => {
	it('accepts a file with valid steps and settings', () => {
		const result = validateBackup({
			version: 2,
			activities: [makeActivity()],
			steps: [makeStep()],
			settings: { stepGoal: 12000 }
		});
		expect(result.valid).toBe(true);
		expect(result.steps).toHaveLength(1);
		expect(result.hasSteps).toBe(true);
		expect(result.settings.stepGoal).toBe(12000);
	});

	it('rejects a steps section that is not an array', () => {
		const result = validateBackup({ version: 2, activities: [], steps: 'nope' });
		expect(result.valid).toBe(false);
	});

	it('rejects an invalid step record', () => {
		const result = validateBackup({
			version: 2,
			activities: [],
			steps: [makeStep(), { date: 'bad', steps: 5 }]
		});
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/indeks 1/i);
	});

	it('rejects a step record with a negative or non-numeric count', () => {
		expect(
			validateBackup({ version: 2, activities: [], steps: [makeRawStep({ steps: -1 })] }).valid
		).toBe(false);
		expect(
			validateBackup({ version: 2, activities: [], steps: [makeRawStep({ steps: 'many' })] }).valid
		).toBe(false);
	});

	it('rejects a step record with an unknown source', () => {
		const result = validateBackup({
			version: 2,
			activities: [],
			steps: [makeRawStep({ source: 'telepathy' })]
		});
		expect(result.valid).toBe(false);
	});

	it('rejects a steps array exceeding the sane per-day maximum', () => {
		const result = validateBackup({
			version: 2,
			activities: [],
			steps: [makeRawStep({ steps: 999999 })]
		});
		expect(result.valid).toBe(false);
	});

	it('clamps an out-of-range step goal instead of rejecting', () => {
		const result = validateBackup({
			version: 2,
			activities: [],
			settings: { stepGoal: 10 }
		});
		expect(result.valid).toBe(true);
		expect(result.settings.stepGoal).toBe(1000);
	});

	it('rejects settings that are not an object', () => {
		const result = validateBackup({ version: 2, activities: [], settings: 'x' });
		expect(result.valid).toBe(false);
	});

	it('rejects a non-numeric step goal', () => {
		const result = validateBackup({
			version: 2,
			activities: [],
			settings: { stepGoal: 'big' }
		});
		expect(result.valid).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// v3: habits / habit logs / focus sessions (backward compatible with v1/v2)
// ---------------------------------------------------------------------------

function makeHabit(overrides: Partial<Habit> = {}): Habit {
	return {
		id: 'h1',
		name: 'Minum air',
		frequency: 'daily',
		targetPerPeriod: 1,
		active: true,
		createdAt: '2024-03-05T08:00:00.000Z',
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

function makeHabitLog(overrides: Partial<HabitLog> = {}): HabitLog {
	return {
		id: 'l1',
		habitId: 'h1',
		date: '2024-03-05',
		completed: true,
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

function makeFocusSession(overrides: Partial<FocusSession> = {}): FocusSession {
	return {
		id: 'f1',
		type: 'pomodoro',
		phase: 'focus',
		startedAt: '2024-03-05T08:00:00.000Z',
		plannedMinutes: 25,
		status: 'completed',
		totalPausedMs: 0,
		createdAt: '2024-03-05T08:00:00.000Z',
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

describe('createBackup (v3)', () => {
	it('includes habits, habit logs and focus sessions', () => {
		const backup = createBackup(
			[makeActivity()],
			[makeStep()],
			{ stepGoal: 12000 },
			[makeHabit()],
			[makeHabitLog()],
			[makeFocusSession()]
		);
		expect(backup.version).toBe(BACKUP_VERSION);
		expect(backup.habits).toHaveLength(1);
		expect(backup.habitLogs).toHaveLength(1);
		expect(backup.focusSessions).toHaveLength(1);
	});

	it('defaults the new sections to empty arrays', () => {
		const backup = createBackup([makeActivity()]);
		expect(backup.habits).toEqual([]);
		expect(backup.habitLogs).toEqual([]);
		expect(backup.focusSessions).toEqual([]);
	});
});

describe('validateBackup (v1/v2 backward compatibility)', () => {
	it('defaults the v3 sections to empty for a v1 file', () => {
		const result = validateBackup({ version: 1, activities: [makeActivity()] });
		expect(result.valid).toBe(true);
		expect(result.habits).toEqual([]);
		expect(result.habitLogs).toEqual([]);
		expect(result.focusSessions).toEqual([]);
	});

	it('defaults the v3 sections to empty for a v2 file', () => {
		const result = validateBackup({
			version: 2,
			activities: [makeActivity()],
			steps: [makeStep()],
			settings: { stepGoal: 9000 }
		});
		expect(result.valid).toBe(true);
		expect(result.habits).toEqual([]);
	});
});

describe('validateBackup (v3)', () => {
	it('accepts a file with valid habits, logs and sessions', () => {
		const result = validateBackup({
			version: 3,
			activities: [makeActivity()],
			steps: [makeStep()],
			settings: { stepGoal: 12000 },
			habits: [makeHabit()],
			habitLogs: [makeHabitLog()],
			focusSessions: [makeFocusSession()]
		});
		expect(result.valid).toBe(true);
		expect(result.habits).toHaveLength(1);
		expect(result.habitLogs).toHaveLength(1);
		expect(result.focusSessions).toHaveLength(1);
	});

	it('rejects a habits section that is not an array', () => {
		expect(validateBackup({ version: 3, activities: [], habits: 'nope' }).valid).toBe(false);
	});

	it('rejects an invalid habit record', () => {
		const result = validateBackup({
			version: 3,
			activities: [],
			habits: [makeHabit(), { id: 'bad' }]
		});
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/indeks 1/i);
	});

	it('rejects a habit with an invalid frequency', () => {
		const result = validateBackup({
			version: 3,
			activities: [],
			habits: [{ ...makeHabit(), frequency: 'hourly' }]
		});
		expect(result.valid).toBe(false);
	});

	it('rejects a habit log with a malformed date', () => {
		const result = validateBackup({
			version: 3,
			activities: [],
			habitLogs: [makeHabitLog({ date: '05/03/2024' })]
		});
		expect(result.valid).toBe(false);
	});

	it('rejects a habitLogs section that is not an array', () => {
		expect(validateBackup({ version: 3, activities: [], habitLogs: 5 }).valid).toBe(false);
	});

	it('rejects a focus session with an unknown status', () => {
		const result = validateBackup({
			version: 3,
			activities: [],
			focusSessions: [{ ...makeFocusSession(), status: 'zombie' }]
		});
		expect(result.valid).toBe(false);
	});

	it('rejects a focusSessions section that is not an array', () => {
		expect(validateBackup({ version: 3, activities: [], focusSessions: {} }).valid).toBe(false);
	});

	it('rejects a focus session with negative paused time', () => {
		const result = validateBackup({
			version: 3,
			activities: [],
			focusSessions: [{ ...makeFocusSession(), totalPausedMs: -1 }]
		});
		expect(result.valid).toBe(false);
	});
});

