import { describe, expect, it } from 'vitest';
import {
	hourLabel,
	hourSlots,
	monthDates,
	monthGrid,
	weekDates,
	weekdayLabels
} from './calendar';

describe('monthDates', () => {
	it('lists all days of a 31-day month', () => {
		expect(monthDates('2024-01-15')).toHaveLength(31);
		expect(monthDates('2024-01-15')[0]).toBe('2024-01-01');
		expect(monthDates('2024-01-15')[30]).toBe('2024-01-31');
	});

	it('handles February in a leap year', () => {
		expect(monthDates('2024-02-10')).toHaveLength(29);
	});

	it('handles February in a non-leap year', () => {
		expect(monthDates('2023-02-10')).toHaveLength(28);
	});
});

describe('monthGrid', () => {
	it('always returns 42 cells', () => {
		expect(monthGrid('2024-01-15')).toHaveLength(42);
		expect(monthGrid('2024-02-15')).toHaveLength(42);
	});

	it('starts on Monday when weekStartsOn = 1', () => {
		const grid = monthGrid('2024-01-15', 1);
		expect(grid[0].weekday).toBe(1);
	});

	it('starts on Sunday when weekStartsOn = 0', () => {
		const grid = monthGrid('2024-01-15', 0);
		expect(grid[0].weekday).toBe(0);
	});

	it('marks in-month days correctly', () => {
		const grid = monthGrid('2024-01-15', 1);
		const inMonth = grid.filter((c) => c.inMonth);
		expect(inMonth).toHaveLength(31);
		expect(inMonth[0].date).toBe('2024-01-01');
	});

	it('is continuous (each cell is one day after the previous)', () => {
		const grid = monthGrid('2024-03-01', 1);
		for (let i = 1; i < grid.length; i++) {
			const prev = new Date(grid[i - 1].date + 'T00:00:00');
			prev.setDate(prev.getDate() + 1);
			const expected = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
			expect(grid[i].date).toBe(expected);
		}
	});
});

describe('weekdayLabels', () => {
	it('starts with Sen for Monday-start weeks', () => {
		expect(weekdayLabels(1)[0].label).toBe('Sen');
		expect(weekdayLabels(1)[6].label).toBe('Min');
	});

	it('starts with Min for Sunday-start weeks', () => {
		expect(weekdayLabels(0)[0].label).toBe('Min');
	});
});

describe('weekDates', () => {
	it('returns 7 consecutive days', () => {
		const week = weekDates('2024-01-17', 1); // Wednesday
		expect(week).toHaveLength(7);
		expect(week[0]).toBe('2024-01-15'); // Monday
		expect(week[6]).toBe('2024-01-21'); // Sunday
	});

	it('respects Sunday start', () => {
		const week = weekDates('2024-01-17', 0);
		expect(week[0]).toBe('2024-01-14'); // Sunday
	});

	it('crosses month boundaries', () => {
		const week = weekDates('2024-01-31', 1);
		expect(week).toContain('2024-02-01');
	});
});

describe('hourSlots / hourLabel', () => {
	it('produces hours 0..23 by default', () => {
		expect(hourSlots()).toHaveLength(24);
		expect(hourSlots()[0]).toBe(0);
		expect(hourSlots()[23]).toBe(23);
	});

	it('supports a custom window', () => {
		expect(hourSlots(6, 9)).toEqual([6, 7, 8]);
	});

	it('formats labels', () => {
		expect(hourLabel(9)).toBe('09:00');
		expect(hourLabel(0)).toBe('00:00');
	});
});
