import { describe, expect, it } from 'vitest';
import {
	activityRange,
	findConflicts,
	findFreeSlots,
	mergeRanges,
	minutesToTime,
	rangesOverlap,
	scheduled,
	sortForTimeline,
	suggestSlot,
	timeToMinutes,
	unscheduled
} from './planner';
import type { Activity } from '$lib/types/activity';

function act(partial: Partial<Activity> & { id: string }): Activity {
	return {
		name: 'A',
		category: 'Other',
		date: '2024-01-15',
		duration: 60,
		completed: false,
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
		...partial
	} as Activity;
}

describe('timeToMinutes', () => {
	it('parses valid times', () => {
		expect(timeToMinutes('00:00')).toBe(0);
		expect(timeToMinutes('06:30')).toBe(390);
		expect(timeToMinutes('23:59')).toBe(1439);
	});
	it('rejects invalid times', () => {
		expect(timeToMinutes('24:00')).toBeNull();
		expect(timeToMinutes('12:60')).toBeNull();
		expect(timeToMinutes('noon')).toBeNull();
		expect(timeToMinutes(undefined)).toBeNull();
	});
});

describe('minutesToTime', () => {
	it('formats minutes', () => {
		expect(minutesToTime(0)).toBe('00:00');
		expect(minutesToTime(390)).toBe('06:30');
	});
	it('clamps', () => {
		expect(minutesToTime(-10)).toBe('00:00');
		expect(minutesToTime(5000)).toBe('24:00');
	});
});

describe('activityRange', () => {
	it('returns null without a start time', () => {
		expect(activityRange({ startTime: undefined, endTime: undefined, duration: 60 })).toBeNull();
	});
	it('uses explicit end time', () => {
		expect(activityRange({ startTime: '09:00', endTime: '10:30', duration: 999 })).toEqual({
			start: 540,
			end: 630
		});
	});
	it('derives end from duration', () => {
		expect(activityRange({ startTime: '09:00', duration: 90 })).toEqual({ start: 540, end: 630 });
	});
	it('falls back to duration when end <= start', () => {
		expect(activityRange({ startTime: '09:00', endTime: '08:00', duration: 30 })).toEqual({
			start: 540,
			end: 570
		});
	});
});

describe('rangesOverlap', () => {
	it('detects overlap', () => {
		expect(rangesOverlap({ start: 0, end: 60 }, { start: 30, end: 90 })).toBe(true);
	});
	it('touching endpoints do not overlap', () => {
		expect(rangesOverlap({ start: 0, end: 60 }, { start: 60, end: 120 })).toBe(false);
	});
	it('disjoint ranges do not overlap', () => {
		expect(rangesOverlap({ start: 0, end: 30 }, { start: 60, end: 90 })).toBe(false);
	});
});

describe('findConflicts', () => {
	it('finds overlapping activities', () => {
		const activities = [act({ id: '1', startTime: '10:00', duration: 60 })];
		const conflicts = findConflicts(activities, { start: 10 * 60 + 30, end: 11 * 60 + 30 });
		expect(conflicts).toHaveLength(1);
		expect(conflicts[0].activity.id).toBe('1');
	});
	it('excludes the given id', () => {
		const activities = [act({ id: '1', startTime: '10:00', duration: 60 })];
		expect(findConflicts(activities, { start: 600, end: 660 }, '1')).toHaveLength(0);
	});
	it('ignores unscheduled activities', () => {
		const activities = [act({ id: '1', startTime: undefined })];
		expect(findConflicts(activities, { start: 0, end: 1440 })).toHaveLength(0);
	});
});

describe('mergeRanges', () => {
	it('merges overlapping and adjacent blocks', () => {
		expect(
			mergeRanges([
				{ start: 0, end: 60 },
				{ start: 30, end: 90 },
				{ start: 90, end: 120 }
			])
		).toEqual([{ start: 0, end: 120 }]);
	});
	it('keeps disjoint blocks separate', () => {
		expect(
			mergeRanges([
				{ start: 0, end: 60 },
				{ start: 120, end: 180 }
			])
		).toEqual([
			{ start: 0, end: 60 },
			{ start: 120, end: 180 }
		]);
	});
});

describe('findFreeSlots', () => {
	it('returns the whole window when empty', () => {
		const slots = findFreeSlots([], 60, 360, 1320);
		expect(slots).toEqual([{ start: 360, end: 1320, startTime: '06:00', endTime: '22:00' }]);
	});

	it('splits around a busy block', () => {
		const activities = [act({ id: '1', startTime: '09:00', duration: 60 })];
		const slots = findFreeSlots(activities, 30, 360, 1320);
		expect(slots.map((s) => [s.startTime, s.endTime])).toEqual([
			['06:00', '09:00'],
			['10:00', '22:00']
		]);
	});

	it('filters out slots shorter than the requested duration', () => {
		const activities = [
			act({ id: '1', startTime: '06:00', duration: 30 }),
			act({ id: '2', startTime: '07:00', duration: 60 })
		];
		// Free: 06:30-07:00 (30m) — too short for a 60m activity.
		const slots = findFreeSlots(activities, 60, 360, 1320);
		expect(slots.map((s) => [s.startTime, s.endTime])).toEqual([['08:00', '22:00']]);
	});

	it('handles a fully booked window', () => {
		const activities = [act({ id: '1', startTime: '06:00', duration: 960 })];
		expect(findFreeSlots(activities, 30, 360, 1320)).toEqual([]);
	});
});

describe('suggestSlot', () => {
	it('returns the earliest fitting slot', () => {
		const activities = [act({ id: '1', startTime: '06:00', duration: 60 })];
		expect(suggestSlot(activities, 60, 360, 1320)?.startTime).toBe('07:00');
	});
	it('returns null when nothing fits', () => {
		const activities = [act({ id: '1', startTime: '06:00', duration: 960 })];
		expect(suggestSlot(activities, 60, 360, 1320)).toBeNull();
	});
});

describe('sortForTimeline / scheduled / unscheduled', () => {
	it('sorts by start time with unscheduled last', () => {
		const list = [
			act({ id: 'a', startTime: '14:00' }),
			act({ id: 'b', startTime: '09:00' }),
			act({ id: 'c', startTime: undefined })
		];
		expect(sortForTimeline(list).map((a) => a.id)).toEqual(['b', 'a', 'c']);
	});
	it('splits scheduled/unscheduled', () => {
		const list = [act({ id: 'a', startTime: '09:00' }), act({ id: 'b', startTime: undefined })];
		expect(scheduled(list).map((a) => a.id)).toEqual(['a']);
		expect(unscheduled(list).map((a) => a.id)).toEqual(['b']);
	});
});
