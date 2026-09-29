/**
 * Planner utilities: time-slot resolution, overlap detection and free-slot
 * search. Pure and deterministic so they can be unit tested without a clock.
 *
 * Times are expressed as minutes since midnight (0..1440) to avoid Date
 * timezone pitfalls; conversion helpers are provided.
 */

import type { Activity } from '$lib/types/activity';

export const DEFAULT_WORK_START = 6 * 60; // 06:00
export const DEFAULT_WORK_END = 22 * 60; // 22:00
export const MIN_SLOT_MINUTES = 15;

export interface TimeRange {
	start: number;
	end: number;
}

/** Parse "HH:MM" into minutes since midnight, or null when invalid. */
export function timeToMinutes(time: string | undefined): number | null {
	if (typeof time !== 'string') return null;
	const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
	if (!match) return null;
	const hh = Number(match[1]);
	const mm = Number(match[2]);
	if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
	return hh * 60 + mm;
}

/** Format minutes since midnight as "HH:MM". */
export function minutesToTime(minutes: number): string {
	const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
	const hh = Math.floor(clamped / 60);
	const mm = clamped % 60;
	return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Resolve an activity's occupied range for a given day.
 * Falls back to a point at the end of the day when no start time is set.
 */
export function activityRange(activity: Pick<Activity, 'startTime' | 'endTime' | 'duration'>): TimeRange | null {
	const start = timeToMinutes(activity.startTime);
	if (start === null) return null;
	const explicitEnd = timeToMinutes(activity.endTime);
	const duration = Number.isFinite(activity.duration) ? activity.duration : 0;
	const end = explicitEnd !== null && explicitEnd > start ? explicitEnd : start + duration;
	return { start, end };
}

/** True when two ranges overlap (touching endpoints do NOT count). */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
	return a.start < b.end && a.end > b.start;
}

export interface Conflict {
	activity: Activity;
	range: TimeRange;
}

/**
 * Find every scheduled activity that overlaps the given range.
 * @param excludeId optional activity id to ignore (e.g. the one being edited)
 */
export function findConflicts(
	activities: Activity[],
	range: TimeRange,
	excludeId?: string
): Conflict[] {
	const conflicts: Conflict[] = [];
	for (const activity of activities) {
		if (excludeId && activity.id === excludeId) continue;
		const other = activityRange(activity);
		if (!other) continue;
		if (rangesOverlap(range, other)) conflicts.push({ activity, range: other });
	}
	return conflicts;
}

/** Merge overlapping ranges into a minimal sorted set of busy blocks. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
	const sorted = [...ranges].sort((a, b) => a.start - b.start);
	const merged: TimeRange[] = [];
	for (const range of sorted) {
		const last = merged[merged.length - 1];
		if (last && range.start <= last.end) {
			last.end = Math.max(last.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}
	return merged;
}

export interface FreeSlot {
	start: number;
	end: number;
	/** "HH:MM" convenience fields. */
	startTime: string;
	endTime: string;
}

/**
 * Compute free slots within [workStart, workEnd] given the day's activities.
 *
 * @param activities activities on the target day
 * @param duration requested duration in minutes (for filtering usable slots)
 * @param workStart window start in minutes (default 06:00)
 * @param workEnd window end in minutes (default 22:00)
 */
export function findFreeSlots(
	activities: Activity[],
	duration: number,
	workStart: number = DEFAULT_WORK_START,
	workEnd: number = DEFAULT_WORK_END
): FreeSlot[] {
	const busy = mergeRanges(
		activities
			.map((activity) => activityRange(activity))
			.filter((range): range is TimeRange => range !== null)
	);

	const slots: FreeSlot[] = [];
	let cursor = workStart;
	for (const block of busy) {
		if (block.start > cursor) {
			slots.push(makeSlot(cursor, block.start));
		}
		cursor = Math.max(cursor, block.end);
	}
	if (cursor < workEnd) {
		slots.push(makeSlot(cursor, workEnd));
	}

	const min = Math.max(MIN_SLOT_MINUTES, Number.isFinite(duration) ? duration : 0);
	return slots.filter((slot) => slot.end - slot.start >= min);
}

function makeSlot(start: number, end: number): FreeSlot {
	return { start, end, startTime: minutesToTime(start), endTime: minutesToTime(end) };
}

/**
 * Suggest the earliest slot for an activity of the given duration.
 * Returns null when no slot fits.
 */
export function suggestSlot(
	activities: Activity[],
	duration: number,
	workStart: number = DEFAULT_WORK_START,
	workEnd: number = DEFAULT_WORK_END
): FreeSlot | null {
	const slots = findFreeSlots(activities, duration, workStart, workEnd);
	return slots.length > 0 ? slots[0] : null;
}

/** Sort activities for a timeline: by start time, then by createdAt. */
export function sortForTimeline(activities: Activity[]): Activity[] {
	return [...activities].sort((a, b) => {
		const aStart = timeToMinutes(a.startTime) ?? Number.MAX_SAFE_INTEGER;
		const bStart = timeToMinutes(b.startTime) ?? Number.MAX_SAFE_INTEGER;
		if (aStart !== bStart) return aStart - bStart;
		return a.createdAt < b.createdAt ? -1 : 1;
	});
}

/** Activities on a day that have no start time (unscheduled bucket). */
export function unscheduled(activities: Activity[]): Activity[] {
	return activities.filter((activity) => timeToMinutes(activity.startTime) === null);
}

/** Activities on a day that have a start time (scheduled bucket). */
export function scheduled(activities: Activity[]): Activity[] {
	return activities.filter((activity) => timeToMinutes(activity.startTime) !== null);
}
