/**
 * Habit streak & schedule math.
 *
 * Key correctness rule: a habit only "counts" on days it is scheduled. Missing a
 * non-scheduled day (e.g. a weekday-only habit on a Saturday) must NOT break the
 * streak. All functions are pure and take explicit dates so they are testable.
 */

import type { Habit, HabitLog, StreakSummary } from '$lib/types/habit';
import { addDays, getLocalDateString, parseLocalDate } from '$lib/utils/date';

/** True when a habit is scheduled on the given local date. */
export function isScheduledOn(habit: Habit, date: string): boolean {
	const parsed = parseLocalDate(date);
	if (!parsed) return false;
	const weekday = parsed.getDay(); // 0=Sun..6=Sat

	switch (habit.frequency) {
		case 'daily':
			return true;
		case 'weekdays':
			return weekday >= 1 && weekday <= 5;
		case 'weekly':
		case 'custom': {
			const days = habit.daysOfWeek && habit.daysOfWeek.length > 0 ? habit.daysOfWeek : null;
			if (!days) return true; // no explicit days -> treat as daily
			return days.includes(weekday);
		}
	}
}

/** Index habit logs as date -> completed. */
export function indexLogs(logs: HabitLog[]): Map<string, HabitLog> {
	const map = new Map<string, HabitLog>();
	for (const log of logs) {
		// Later writes win; callers should pass the freshest data.
		map.set(log.date, log);
	}
	return map;
}

export function isCompletedOn(logIndex: Map<string, HabitLog>, date: string): boolean {
	return logIndex.get(date)?.completed === true;
}

export interface StreakOptions {
	/** Today's local date. Defaults to the machine's today. */
	today?: string;
	/** How far back to look, in days (safety bound). */
	maxLookback?: number;
}

/**
 * Current streak: consecutive scheduled days completed, counting back from the
 * most recent scheduled day (today, or the last scheduled day if today is not
 * scheduled).
 */
export function calculateCurrentStreak(
	habit: Habit,
	logs: HabitLog[],
	options: StreakOptions = {}
): number {
	const today = options.today ?? getLocalDateString();
	const maxLookback = options.maxLookback ?? 3650;
	const logIndex = indexLogs(logs);

	// Walk back from today; stop at the first scheduled day that is not done.
	let streak = 0;
	let cursor = today;
	let scheduledSeen = false;

	for (let i = 0; i <= maxLookback; i++) {
		if (isScheduledOn(habit, cursor)) {
			scheduledSeen = true;
			if (isCompletedOn(logIndex, cursor)) {
				streak += 1;
			} else {
				// Allow "today not yet done" to not break an existing streak.
				if (cursor === today && i === 0) {
					cursor = addDays(cursor, -1);
					continue;
				}
				break;
			}
		}
		cursor = addDays(cursor, -1);
	}

	// If the habit has never been scheduled (e.g. custom with no days) yet has
	// completions, fall back to a simple consecutive count.
	if (!scheduledSeen && streak === 0) {
		return 0;
	}
	return streak;
}

/**
 * Longest streak ever: the longest run of consecutive scheduled days completed.
 * Non-scheduled days are skipped (they neither extend nor break a run).
 */
export function calculateLongestStreak(habit: Habit, logs: HabitLog[]): number {
	const completed = logs
		.filter((log) => log.completed && isScheduledOn(habit, log.date))
		.map((log) => log.date)
		.sort();
	if (completed.length === 0) return 0;

	let longest = 1;
	let run = 1;
	for (let i = 1; i < completed.length; i++) {
		const prev = completed[i - 1];
		const curr = completed[i];
		if (areConsecutiveScheduled(habit, prev, curr)) {
			run += 1;
		} else {
			run = 1;
		}
		longest = Math.max(longest, run);
	}
	return longest;
}

/**
 * True when `next` is the next *scheduled* day after `prev` for this habit
 * (skipping any non-scheduled days in between).
 */
function areConsecutiveScheduled(habit: Habit, prev: string, next: string): boolean {
	let cursor = addDays(prev, 1);
	// Walk forward until we hit the next scheduled day; if it's `next`, they are
	// consecutive in schedule terms.
	for (let guard = 0; guard < 366; guard++) {
		if (cursor === next) return true;
		if (isScheduledOn(habit, cursor)) {
			// Hit a scheduled day that is not `next` -> gap.
			return false;
		}
		cursor = addDays(cursor, 1);
		// Stop once we pass next.
		if (cursor > next) return false;
	}
	return false;
}

/** Completion rate over scheduled days within [from, to] (inclusive). */
export function calculateCompletionRate(
	habit: Habit,
	logs: HabitLog[],
	from: string,
	to: string
): number {
	const logIndex = indexLogs(logs);
	let scheduled = 0;
	let completed = 0;
	let cursor = from;
	for (let guard = 0; guard < 3660 && cursor <= to; guard++) {
		if (isScheduledOn(habit, cursor)) {
			scheduled += 1;
			if (isCompletedOn(logIndex, cursor)) completed += 1;
		}
		cursor = addDays(cursor, 1);
	}
	return scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100);
}

/** Convenience: full streak summary for a habit. */
export function summarize(
	habit: Habit,
	logs: HabitLog[],
	today?: string
): StreakSummary {
	const day = today ?? getLocalDateString();
	const from = addDays(day, -29);
	return {
		current: calculateCurrentStreak(habit, logs, { today: day }),
		longest: calculateLongestStreak(habit, logs),
		completionRate: calculateCompletionRate(habit, logs, from, day)
	};
}

/** Heatmap level 0..4 for a day (0 = no scheduled habit / no data). */
export function heatLevel(
	habit: Habit,
	logIndex: Map<string, HabitLog>,
	date: string,
	today: string
): 0 | 1 | 2 | 3 | 4 {
	if (!isScheduledOn(habit, date)) return 0;
	if (date > today) return 0;
	const log = logIndex.get(date);
	if (log?.completed) return 4;
	const target = habit.targetPerPeriod > 0 ? habit.targetPerPeriod : 1;
	const value = log?.value ?? 0;
	if (value <= 0) return 1; // scheduled, not done
	const ratio = Math.min(1, value / target);
	if (ratio >= 0.75) return 3;
	if (ratio >= 0.4) return 2;
	return 1;
}
