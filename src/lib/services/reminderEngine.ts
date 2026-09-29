/**
 * Reminder scheduling engine.
 *
 * IMPORTANT — web platform limitations (documented, not faked):
 *  - A page/service worker cannot guarantee an alarm fires when the browser is
 *    closed, the PWA is killed by the OS, or background execution is suspended.
 *  - Autoplay policies may block sound until the user has interacted with the
 *    page at least once.
 *
 * Therefore this engine only fires reminders while the app is open in a tab and
 * exposes graceful fallbacks. The scheduling math itself is pure and testable.
 */

import type { Activity } from '$lib/types/activity';
import type { ReminderConfig } from '$lib/types/common';
import { addDays, formatLocalTime, getLocalDateString } from '$lib/utils/date';

export interface ReminderOccurrence {
	/** Stable key so the same occurrence never fires twice. */
	key: string;
	activityId: string;
	activityName: string;
	/** Date (YYYY-MM-DD) the reminder belongs to. */
	date: string;
	/** Local time "HH:MM" it should fire at. */
	time: string;
	/** Epoch ms of the fire time. */
	fireAt: number;
	snoozeMinutes: number;
}

/** Combine a local date + "HH:MM" into epoch ms. Returns null when malformed. */
export function fireTimestamp(date: string, time: string): number | null {
	const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
	if (!dateMatch || !timeMatch) return null;
	const [y, mo, d] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
	const [hh, mm] = [Number(timeMatch[1]), Number(timeMatch[2])];
	const ts = new Date(y, mo - 1, d, hh, mm, 0, 0).getTime();
	return Number.isFinite(ts) ? ts : null;
}

export function hasReminder(activity: Activity): boolean {
	return Boolean(activity.reminder?.enabled && resolveReminderTime(activity));
}

/**
 * Resolve the reminder time for an activity:
 *  1. explicit reminder.time, else
 *  2. startTime minus reminder.minutesBefore, else
 *  3. null (no time to schedule).
 */
export function resolveReminderTime(activity: Activity): string | null {
	const reminder = activity.reminder;
	if (!reminder || !reminder.enabled) return null;
	if (reminder.time) return reminder.time;
	if (activity.startTime && reminder.minutesBefore != null) {
		const match = /^(\d{1,2}):(\d{2})$/.exec(activity.startTime);
		if (!match) return null;
		const total =
			Number(match[1]) * 60 + Number(match[2]) - Math.max(0, reminder.minutesBefore);
		const wrapped = ((total % 1440) + 1440) % 1440;
		const hh = Math.floor(wrapped / 60);
		const mm = wrapped % 60;
		return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
	}
	return null;
}

/**
 * Resolve the reminder as a concrete local date + time.
 *
 * Unlike {@link resolveReminderTime}, this also reports the *day offset* so a
 * reminder whose `minutesBefore` crosses midnight is scheduled on the correct
 * (previous) calendar day instead of silently wrapping onto the same date.
 */
export function resolveReminderDateTime(
	activity: Activity
): { date: string; time: string; fireAt: number } | null {
	const reminder = activity.reminder;
	if (!reminder || !reminder.enabled) return null;

	if (reminder.time) {
		const fireAt = fireTimestamp(activity.date, reminder.time);
		if (fireAt === null) return null;
		return { date: activity.date, time: reminder.time, fireAt };
	}

	if (activity.startTime && reminder.minutesBefore != null) {
		const match = /^(\d{1,2}):(\d{2})$/.exec(activity.startTime);
		if (!match) return null;
		const startMinutes = Number(match[1]) * 60 + Number(match[2]);
		const target = startMinutes - Math.max(0, reminder.minutesBefore);
		// Day offset: how many whole days the target time slid backwards.
		const dayOffset = Math.floor(target / 1440);
		const wrapped = ((target % 1440) + 1440) % 1440;
		const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
		const mm = String(wrapped % 60).padStart(2, '0');
		const date =
			dayOffset === 0 ? activity.date : addDays(activity.date, dayOffset);
		const fireAt = fireTimestamp(date, `${hh}:${mm}`);
		if (fireAt === null) return null;
		return { date, time: `${hh}:${mm}`, fireAt };
	}

	return null;
}

/**
 * Build the list of pending occurrences that should fire between `now` and
 * `now + horizonMs`. Occurrences already snoozed are pushed forward via the
 * activity's `snoozedUntil`.
 */
export function pendingOccurrences(
	activities: Activity[],
	now: number,
	horizonMs = 60 * 60 * 1000
): ReminderOccurrence[] {
	const occurrences: ReminderOccurrence[] = [];
	for (const activity of activities) {
		if (!hasReminder(activity)) continue;
		const time = resolveReminderTime(activity)!;
		// Snooze overrides the scheduled time.
		if (activity.snoozedUntil) {
			const snoozeAt = Date.parse(activity.snoozedUntil);
			if (Number.isFinite(snoozeAt)) {
				if (snoozeAt <= now + horizonMs) {
					occurrences.push({
						key: `${activity.id}@${activity.snoozedUntil}`,
						activityId: activity.id,
						activityName: activity.name,
						date: getLocalDateString(new Date(snoozeAt)),
						time: formatLocalTime(new Date(snoozeAt)),
						fireAt: snoozeAt,
						snoozeMinutes: activity.reminder?.snoozeMinutes ?? 5
					});
				}
				continue;
			}
		}
		const fireAt = fireTimestamp(activity.date, time);
		if (fireAt === null) continue;
		if (fireAt >= now && fireAt <= now + horizonMs) {
			occurrences.push({
				key: `${activity.id}@${activity.date}T${time}`,
				activityId: activity.id,
				activityName: activity.name,
				date: activity.date,
				time,
				fireAt,
				snoozeMinutes: activity.reminder?.snoozeMinutes ?? 5
			});
		}
	}
	return occurrences.sort((a, b) => a.fireAt - b.fireAt);
}

/**
 * All occurrences that are due right now and not already fired, oldest first.
 *
 * Uses a wide grace window (default 24h) so occurrences missed while the tab
 * was suspended, backgrounded or the device slept are still surfaced on the
 * next tick instead of being silently dropped. The `firedKeys` set guarantees
 * each occurrence is only emitted once, so a wide window is safe.
 */
export function dueOccurrences(
	activities: Activity[],
	now: number,
	firedKeys: Set<string>,
	graceMs = 24 * 60 * 60 * 1000
): ReminderOccurrence[] {
	const due: ReminderOccurrence[] = [];
	for (const activity of activities) {
		if (!hasReminder(activity)) continue;
		if (activity.snoozedUntil) {
			const snoozeAt = Date.parse(activity.snoozedUntil);
			if (Number.isFinite(snoozeAt) && snoozeAt <= now && now - snoozeAt <= graceMs) {
				const key = `${activity.id}@${activity.snoozedUntil}`;
				if (!firedKeys.has(key)) {
					due.push({
						key,
						activityId: activity.id,
						activityName: activity.name,
						date: getLocalDateString(new Date(snoozeAt)),
						time: formatLocalTime(new Date(snoozeAt)),
						fireAt: snoozeAt,
						snoozeMinutes: activity.reminder?.snoozeMinutes ?? 5
					});
				}
			}
			continue;
		}
		const resolved = resolveReminderDateTime(activity);
		if (!resolved) continue;
		if (resolved.fireAt <= now && now - resolved.fireAt <= graceMs) {
			const key = `${activity.id}@${resolved.date}T${resolved.time}`;
			if (!firedKeys.has(key)) {
				due.push({
					key,
					activityId: activity.id,
					activityName: activity.name,
					date: resolved.date,
					time: resolved.time,
					fireAt: resolved.fireAt,
					snoozeMinutes: activity.reminder?.snoozeMinutes ?? 5
				});
			}
		}
	}
	return due.sort((a, b) => a.fireAt - b.fireAt);
}

/**
 * The occurrence that is due right now (within a small grace window) and not
 * already dismissed. Returns the earliest one.
 */
export function dueOccurrence(
	activities: Activity[],
	now: number,
	firedKeys: Set<string>,
	graceMs = 60_000
): ReminderOccurrence | null {
	for (const activity of activities) {
		if (!hasReminder(activity)) continue;
		if (activity.snoozedUntil) {
			const snoozeAt = Date.parse(activity.snoozedUntil);
			if (Number.isFinite(snoozeAt) && snoozeAt <= now && now - snoozeAt <= graceMs) {
				const key = `${activity.id}@${activity.snoozedUntil}`;
				if (!firedKeys.has(key)) {
					return {
						key,
						activityId: activity.id,
						activityName: activity.name,
						date: getLocalDateString(new Date(snoozeAt)),
						time: formatLocalTime(new Date(snoozeAt)),
						fireAt: snoozeAt,
						snoozeMinutes: activity.reminder?.snoozeMinutes ?? 5
					};
				}
			}
			continue;
		}
		const resolved = resolveReminderDateTime(activity);
		if (!resolved) continue;
		if (resolved.fireAt <= now && now - resolved.fireAt <= graceMs) {
			const key = `${activity.id}@${resolved.date}T${resolved.time}`;
			if (!firedKeys.has(key)) {
				return {
					key,
					activityId: activity.id,
					activityName: activity.name,
					date: resolved.date,
					time: resolved.time,
					fireAt: resolved.fireAt,
					snoozeMinutes: activity.reminder?.snoozeMinutes ?? 5
				};
			}
		}
	}
	return null;
}

/** Default reminder config used when enabling a reminder. */
export function defaultReminder(overrides: Partial<ReminderConfig> = {}): ReminderConfig {
	return { enabled: true, sound: true, vibration: true, snoozeMinutes: 5, ...overrides };
}
