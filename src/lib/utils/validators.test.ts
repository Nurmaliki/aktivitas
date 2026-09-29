import { describe, expect, it } from 'vitest';
import {
	isValidFocusSession,
	isValidHabit,
	isValidHabitLog,
	isValidPriority,
	isValidRecurrence,
	isValidReminder,
	isValidSubtask
} from './validators';

const validSubtask = { id: 's1', title: 'Step', completed: false, order: 0, createdAt: 'x' };

const validHabit = {
	id: 'h1',
	name: 'Minum air',
	frequency: 'daily',
	targetPerPeriod: 1,
	active: true,
	createdAt: 'x',
	updatedAt: 'y'
};

const validLog = {
	id: 'l1',
	habitId: 'h1',
	date: '2024-01-15',
	completed: true,
	updatedAt: 'y'
};

const validFocus = {
	id: 'f1',
	type: 'pomodoro',
	phase: 'focus',
	startedAt: 'x',
	plannedMinutes: 25,
	status: 'running',
	totalPausedMs: 0,
	createdAt: 'x',
	updatedAt: 'y'
};

describe('isValidSubtask', () => {
	it('accepts a valid subtask', () => expect(isValidSubtask(validSubtask)).toBe(true));
	it('rejects missing title', () =>
		expect(isValidSubtask({ ...validSubtask, title: '' })).toBe(false));
	it('rejects non-boolean completed', () =>
		expect(isValidSubtask({ ...validSubtask, completed: 'yes' })).toBe(false));
	it('rejects non-finite order', () =>
		expect(isValidSubtask({ ...validSubtask, order: NaN })).toBe(false));
	it('rejects null', () => expect(isValidSubtask(null)).toBe(false));
});

describe('isValidPriority', () => {
	it('accepts known priorities', () => {
		expect(isValidPriority('low')).toBe(true);
		expect(isValidPriority('high')).toBe(true);
	});
	it('rejects unknown', () => expect(isValidPriority('urgent')).toBe(false));
});

describe('isValidRecurrence', () => {
	it('accepts daily', () => expect(isValidRecurrence({ frequency: 'daily' })).toBe(true));
	it('accepts weekdays with days', () =>
		expect(isValidRecurrence({ frequency: 'custom', daysOfWeek: [1, 3, 5] })).toBe(true));
	it('rejects bad frequency', () => expect(isValidRecurrence({ frequency: 'hourly' })).toBe(false));
	it('rejects out-of-range day', () =>
		expect(isValidRecurrence({ frequency: 'custom', daysOfWeek: [7] })).toBe(false));
	it('rejects bad endDate', () =>
		expect(isValidRecurrence({ frequency: 'daily', endDate: '15-01-2024' })).toBe(false));
});

describe('isValidReminder', () => {
	it('accepts a minimal reminder', () =>
		expect(isValidReminder({ enabled: true, sound: true, vibration: true, snoozeMinutes: 5 })).toBe(
			true
		));
	it('rejects bad time', () =>
		expect(
			isValidReminder({ enabled: true, sound: true, vibration: true, snoozeMinutes: 5, time: '25:00' })
		).toBe(false));
	it('rejects negative snooze', () =>
		expect(
			isValidReminder({ enabled: true, sound: true, vibration: true, snoozeMinutes: -1 })
		).toBe(false));
});

describe('isValidHabit', () => {
	it('accepts a valid habit', () => expect(isValidHabit(validHabit)).toBe(true));
	it('rejects unknown frequency', () =>
		expect(isValidHabit({ ...validHabit, frequency: 'hourly' })).toBe(false));
	it('rejects zero target', () =>
		expect(isValidHabit({ ...validHabit, targetPerPeriod: 0 })).toBe(false));
	it('rejects missing active flag', () => {
		const { active, ...rest } = validHabit;
		void active;
		expect(isValidHabit(rest)).toBe(false);
	});
});

describe('isValidHabitLog', () => {
	it('accepts a valid log', () => expect(isValidHabitLog(validLog)).toBe(true));
	it('rejects bad date', () => expect(isValidHabitLog({ ...validLog, date: '15/01/2024' })).toBe(false));
	it('rejects missing habitId', () => expect(isValidHabitLog({ ...validLog, habitId: '' })).toBe(false));
});

describe('isValidFocusSession', () => {
	it('accepts a valid session', () => expect(isValidFocusSession(validFocus)).toBe(true));
	it('rejects unknown status', () =>
		expect(isValidFocusSession({ ...validFocus, status: 'zombie' })).toBe(false));
	it('rejects negative paused time', () =>
		expect(isValidFocusSession({ ...validFocus, totalPausedMs: -1 })).toBe(false));
	it('rejects bad phase', () => expect(isValidFocusSession({ ...validFocus, phase: 'nap' })).toBe(false));
});
