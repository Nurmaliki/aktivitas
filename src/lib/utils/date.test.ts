import { describe, expect, it } from 'vitest';
import {
	addDays,
	getDateRange,
	getLastNDays,
	getLocalDateString,
	getMonthDates,
	getMonthStart,
	getWeekdayShort,
	isValidDateString,
	localDateFromISO,
	parseLocalDate
} from '$lib/utils/date';
import { formatDuration } from '$lib/utils/statistics';

describe('getLocalDateString', () => {
	it('formats a date as local YYYY-MM-DD with zero padding', () => {
		// 5 March 2024 at 23:30 local time — must NOT roll over to the next day.
		const date = new Date(2024, 2, 5, 23, 30, 0);
		expect(getLocalDateString(date)).toBe('2024-03-05');
	});

	it('does not shift the day for a late-night local time (timezone safety)', () => {
		const lateNight = new Date(2025, 0, 1, 0, 15, 0); // 1 Jan 00:15 local
		expect(getLocalDateString(lateNight)).toBe('2025-01-01');
	});
});

describe('parseLocalDate', () => {
	it('parses a valid local date at midnight', () => {
		const date = parseLocalDate('2024-07-15');
		expect(date).not.toBeNull();
		expect(date!.getFullYear()).toBe(2024);
		expect(date!.getMonth()).toBe(6);
		expect(date!.getDate()).toBe(15);
		expect(date!.getHours()).toBe(0);
	});

	it('rejects malformed strings', () => {
		expect(parseLocalDate('2024/07/15')).toBeNull();
		expect(parseLocalDate('15-07-2024')).toBeNull();
		expect(parseLocalDate('')).toBeNull();
		expect(parseLocalDate('not-a-date')).toBeNull();
	});

	it('rejects overflow dates such as 2024-02-31', () => {
		expect(parseLocalDate('2024-02-31')).toBeNull();
		expect(parseLocalDate('2023-02-29')).toBeNull();
	});

	it('accepts a real leap day', () => {
		expect(parseLocalDate('2024-02-29')).not.toBeNull();
	});
});

describe('isValidDateString', () => {
	it('validates correct dates and rejects invalid ones', () => {
		expect(isValidDateString('2024-12-31')).toBe(true);
		expect(isValidDateString('2024-13-01')).toBe(false);
		expect(isValidDateString('abc')).toBe(false);
	});
});

describe('addDays', () => {
	it('adds days across month boundaries', () => {
		expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
	});

	it('subtracts days across month boundaries', () => {
		expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
	});

	it('handles year boundaries', () => {
		expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
	});
});

describe('getDateRange', () => {
	it('returns an inclusive range', () => {
		expect(getDateRange('2024-01-29', '2024-02-02')).toEqual([
			'2024-01-29',
			'2024-01-30',
			'2024-01-31',
			'2024-02-01',
			'2024-02-02'
		]);
	});

	it('returns an empty array when start is after end', () => {
		expect(getDateRange('2024-02-02', '2024-01-01')).toEqual([]);
	});
});

describe('getLastNDays', () => {
	it('returns N days ending on the given day', () => {
		const days = getLastNDays(7, '2024-03-05');
		expect(days).toHaveLength(7);
		expect(days[0]).toBe('2024-02-28');
		expect(days[6]).toBe('2024-03-05');
	});
});

describe('getMonthDates', () => {
	it('returns every day in a 31-day month', () => {
		expect(getMonthDates('2024-01-15')).toHaveLength(31);
	});

	it('returns 29 days for February in a leap year', () => {
		expect(getMonthDates('2024-02-10')).toHaveLength(29);
	});

	it('returns 28 days for February in a common year', () => {
		expect(getMonthDates('2023-02-10')).toHaveLength(28);
	});

	it('covers month transition correctly (end of month dates)', () => {
		const dates = getMonthDates('2024-04-30');
		expect(dates[dates.length - 1]).toBe('2024-04-30');
		expect(dates[0]).toBe('2024-04-01');
	});
});

describe('getMonthStart', () => {
	it('returns the first day of the month', () => {
		expect(getMonthStart('2024-07-19')).toBe('2024-07-01');
	});
});

describe('getWeekdayShort', () => {
	it('returns Indonesian short weekday labels', () => {
		// 2024-03-04 is a Monday.
		expect(getWeekdayShort('2024-03-04')).toBe('Sen');
		// 2024-03-03 is a Sunday.
		expect(getWeekdayShort('2024-03-03')).toBe('Min');
	});
});

describe('formatDuration', () => {
	it('formats hours and minutes', () => {
		expect(formatDuration(270)).toBe('4j 30m');
	});

	it('formats whole hours without minutes', () => {
		expect(formatDuration(120)).toBe('2j');
	});

	it('formats minutes under an hour', () => {
		expect(formatDuration(45)).toBe('45m');
	});

	it('handles zero and invalid values gracefully', () => {
		expect(formatDuration(0)).toBe('0m');
		expect(formatDuration(-10)).toBe('0m');
		expect(formatDuration(NaN)).toBe('0m');
		expect(formatDuration(Infinity)).toBe('0m');
	});
});

describe('localDateFromISO', () => {
	it('maps a timestamp to the local calendar date', () => {
		// 2024-03-05T23:30 local -> local date 2024-03-05 regardless of UTC offset.
		const iso = new Date(2024, 2, 5, 23, 30).toISOString();
		expect(localDateFromISO(iso)).toBe('2024-03-05');
	});

	it('handles local midnight boundaries in local time', () => {
		const iso = new Date(2024, 2, 5, 0, 15).toISOString();
		expect(localDateFromISO(iso)).toBe('2024-03-05');
	});

	it('returns an empty string for invalid input', () => {
		expect(localDateFromISO('not-a-date')).toBe('');
	});
});
