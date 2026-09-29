/**
 * Validators for v3 domain records (habit, habit log, focus session, subtask).
 *
 * Kept separate from `validation.ts` (which owns the Activity domain) so each
 * file stays focused. All validators are pure and defensive: they never trust
 * data coming from IndexedDB or an imported file.
 */

import type { Habit, HabitFrequency, HabitLog } from '$lib/types/habit';
import { HABIT_FREQUENCIES } from '$lib/types/habit';
import type { FocusSession, FocusSessionStatus, FocusPhase } from '$lib/types/focus';
import type { Priority, ReminderConfig, RecurrenceRule, Subtask } from '$lib/types/common';
import { isValidDateString } from '$lib/utils/date';
import { isValidTimeString } from '$lib/utils/validation';

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const FOCUS_STATUSES: FocusSessionStatus[] = ['running', 'paused', 'completed', 'cancelled'];
const FOCUS_PHASES: FocusPhase[] = ['focus', 'shortBreak', 'longBreak'];

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

export function isValidSubtask(value: unknown): value is Subtask {
	if (typeof value !== 'object' || value === null) return false;
	const r = value as Record<string, unknown>;
	if (typeof r.id !== 'string' || !r.id.trim()) return false;
	if (typeof r.title !== 'string' || !r.title.trim()) return false;
	if (typeof r.completed !== 'boolean') return false;
	if (!isFiniteNumber(r.order)) return false;
	if (typeof r.createdAt !== 'string' || !r.createdAt) return false;
	return true;
}

export function isValidPriority(value: unknown): value is Priority {
	return typeof value === 'string' && PRIORITIES.includes(value as Priority);
}

export function isValidRecurrence(value: unknown): value is RecurrenceRule {
	if (typeof value !== 'object' || value === null) return false;
	const r = value as Record<string, unknown>;
	const freqs = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'custom'];
	if (typeof r.frequency !== 'string' || !freqs.includes(r.frequency)) return false;
	if (r.interval != null && (!isFiniteNumber(r.interval) || r.interval < 1)) return false;
	if (r.daysOfWeek != null) {
		if (!Array.isArray(r.daysOfWeek)) return false;
		if (!r.daysOfWeek.every((d) => isFiniteNumber(d) && d >= 0 && d <= 6)) return false;
	}
	if (r.endDate != null && (typeof r.endDate !== 'string' || !isValidDateString(r.endDate))) {
		return false;
	}
	return true;
}

export function isValidReminder(value: unknown): value is ReminderConfig {
	if (typeof value !== 'object' || value === null) return false;
	const r = value as Record<string, unknown>;
	if (typeof r.enabled !== 'boolean') return false;
	if (typeof r.sound !== 'boolean') return false;
	if (typeof r.vibration !== 'boolean') return false;
	if (!isFiniteNumber(r.snoozeMinutes) || r.snoozeMinutes < 0) return false;
	if (r.time != null && !isValidTimeString(r.time)) return false;
	if (r.minutesBefore != null && !isFiniteNumber(r.minutesBefore)) return false;
	if (r.repeat != null && !isValidRecurrence(r.repeat)) return false;
	return true;
}

export function isValidHabit(value: unknown): value is Habit {
	if (typeof value !== 'object' || value === null) return false;
	const r = value as Record<string, unknown>;
	if (typeof r.id !== 'string' || !r.id.trim()) return false;
	if (typeof r.name !== 'string' || !r.name.trim() || r.name.length > 120) return false;
	if (r.description != null && typeof r.description !== 'string') return false;
	if (typeof r.frequency !== 'string' || !HABIT_FREQUENCIES.includes(r.frequency as HabitFrequency)) {
		return false;
	}
	if (r.daysOfWeek != null) {
		if (!Array.isArray(r.daysOfWeek)) return false;
		if (!r.daysOfWeek.every((d) => isFiniteNumber(d) && d >= 0 && d <= 6)) return false;
	}
	if (!isFiniteNumber(r.targetPerPeriod) || r.targetPerPeriod < 1) return false;
	if (r.reminder != null && !isValidReminder(r.reminder)) return false;
	if (typeof r.active !== 'boolean') return false;
	if (typeof r.createdAt !== 'string' || !r.createdAt) return false;
	if (typeof r.updatedAt !== 'string' || !r.updatedAt) return false;
	return true;
}

export function isValidHabitLog(value: unknown): value is HabitLog {
	if (typeof value !== 'object' || value === null) return false;
	const r = value as Record<string, unknown>;
	if (typeof r.id !== 'string' || !r.id.trim()) return false;
	if (typeof r.habitId !== 'string' || !r.habitId.trim()) return false;
	if (typeof r.date !== 'string' || !isValidDateString(r.date)) return false;
	if (typeof r.completed !== 'boolean') return false;
	if (r.value != null && !isFiniteNumber(r.value)) return false;
	if (typeof r.updatedAt !== 'string' || !r.updatedAt) return false;
	return true;
}

export function isValidFocusSession(value: unknown): value is FocusSession {
	if (typeof value !== 'object' || value === null) return false;
	const r = value as Record<string, unknown>;
	if (typeof r.id !== 'string' || !r.id.trim()) return false;
	if (r.activityId != null && typeof r.activityId !== 'string') return false;
	if (r.type !== 'pomodoro' && r.type !== 'stopwatch') return false;
	if (typeof r.phase !== 'string' || !FOCUS_PHASES.includes(r.phase as FocusPhase)) return false;
	if (typeof r.startedAt !== 'string' || !r.startedAt) return false;
	if (!isFiniteNumber(r.plannedMinutes)) return false;
	if (typeof r.status !== 'string' || !FOCUS_STATUSES.includes(r.status as FocusSessionStatus)) {
		return false;
	}
	if (!isFiniteNumber(r.totalPausedMs) || r.totalPausedMs < 0) return false;
	if (typeof r.createdAt !== 'string' || !r.createdAt) return false;
	if (typeof r.updatedAt !== 'string' || !r.updatedAt) return false;
	return true;
}
