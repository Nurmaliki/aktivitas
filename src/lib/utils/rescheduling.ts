/**
 * Smart rescheduling utilities.
 *
 * Detects past, unfinished ("missed") activities and offers — but never applies
 * without user action — concrete reschedule options:
 *   - later today (next free slot)
 *   - tomorrow (same time)
 *   - a suggested free slot on a chosen date
 *
 * All pure functions.
 */

import type { Activity } from '$lib/types/activity';
import { addDays, getLocalDateString, formatDisplayDate } from '$lib/utils/date';
import { findFreeSlots, suggestSlot, type FreeSlot } from '$lib/utils/planner';

export interface MissedActivity {
	activity: Activity;
	/** Why it is considered missed. */
	reason: 'past-date' | 'past-time';
}

/**
 * Find activities that were scheduled in the past and are still not completed.
 * Cancelled/skipped records are ignored; a completed record is never missed.
 */
export function findMissedActivities(
	activities: Activity[],
	today: string = getLocalDateString(),
	now: Date = new Date()
): MissedActivity[] {
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const result: MissedActivity[] = [];

	for (const activity of activities) {
		if (activity.completed) continue;
		if (activity.status === 'skipped' || activity.status === 'cancelled') continue;
		if (activity.status === 'completed') continue;

		if (activity.date < today) {
			result.push({ activity, reason: 'past-date' });
			continue;
		}
		if (activity.date === today) {
			// If it has a time slot that has fully passed, it is missed.
			const end = endMinutes(activity);
			if (end !== null && end < nowMinutes) {
				result.push({ activity, reason: 'past-time' });
			}
		}
	}

	// Most recent first.
	return result.sort((a, b) => (a.activity.date < b.activity.date ? 1 : -1));
}

function endMinutes(activity: Activity): number | null {
	if (!activity.startTime) return null;
	const match = /^(\d{1,2}):(\d{2})$/.exec(activity.startTime);
	if (!match) return null;
	const start = Number(match[1]) * 60 + Number(match[2]);
	return start + (Number.isFinite(activity.duration) ? activity.duration : 0);
}

export interface RescheduleOption {
	id: 'later-today' | 'tomorrow' | 'slot';
	label: string;
	date: string;
	startTime?: string;
	endTime?: string;
}

/**
 * Build the reschedule options offered to the user for a missed activity.
 * Options that are impossible (no free slot today) are omitted.
 */
export function rescheduleOptions(
	activity: Activity,
	activities: Activity[],
	today: string = getLocalDateString(),
	now: Date = new Date()
): RescheduleOption[] {
	const options: RescheduleOption[] = [];
	const duration = Number.isFinite(activity.duration) ? activity.duration : 30;

	// Later today: earliest free slot starting after "now".
	const todayActivities = activities.filter((a) => a.date === today && a.id !== activity.id);
	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	const slot = suggestSlot(todayActivities, duration, Math.max(360, nowMinutes), 22 * 60);
	if (slot && slot.start >= nowMinutes) {
		options.push({
			id: 'later-today',
			label: `Hari ini ${slot.startTime}–${slot.endTime}`,
			date: today,
			startTime: slot.startTime,
			endTime: slot.endTime
		});
	}

	// Tomorrow, preserving the original time of day when present.
	const tomorrow = addDays(today, 1);
	const tomorrowTime = activity.startTime;
	options.push({
		id: 'tomorrow',
		label: tomorrowTime
			? `Besok ${tomorrowTime}`
			: `Besok (${formatDisplayDate(tomorrow)})`,
		date: tomorrow,
		startTime: tomorrowTime,
		endTime: activity.endTime
	});

	// A suggested slot on the original/target date.
	const targetDate = activity.date >= today ? activity.date : today;
	const targetActivities = activities.filter((a) => a.date === targetDate && a.id !== activity.id);
	const freeSlots: FreeSlot[] = findFreeSlots(targetActivities, duration);
	if (freeSlots.length > 0) {
		const best = freeSlots[0];
		options.push({
			id: 'slot',
			label: `${formatDisplayDate(targetDate)} ${best.startTime}–${best.endTime}`,
			date: targetDate,
			startTime: best.startTime,
			endTime: best.endTime
		});
	}

	return options;
}

/** Summary sentence describing a missed activity (for the UI). */
export function missedMessage(missed: MissedActivity): string {
	const { activity } = missed;
	if (missed.reason === 'past-date') {
		return `"${activity.name}" (${formatDisplayDate(activity.date)}) belum selesai.`;
	}
	return `"${activity.name}" yang dijadwalkan hari ini belum selesai.`;
}
