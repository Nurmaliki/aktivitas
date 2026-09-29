/**
 * Calendar utilities: month/week grids built from local dates.
 *
 * Pure functions so the calendar views share one correct source of truth for
 * grid shape and weekday alignment.
 */

import { getLocalDateString, getMonthStart, getWeekdayShort, parseLocalDate } from '$lib/utils/date';

export interface CalendarCell {
	/** Local date string YYYY-MM-DD. */
	date: string;
	/** Day-of-month number. */
	day: number;
	/** True when the date belongs to the target month. */
	inMonth: boolean;
	isToday: boolean;
	weekday: number;
}

/** First day of week (0=Sun .. 1=Mon .. 6=Sat). */
export type WeekStart = 0 | 1;

/** All days of the target month. */
export function monthDates(monthAnchor: string): string[] {
	const start = parseLocalDate(getMonthStart(monthAnchor));
	if (!start) return [];
	const year = start.getFullYear();
	const month = start.getMonth();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const out: string[] = [];
	for (let day = 1; day <= daysInMonth; day++) {
		out.push(getLocalDateString(new Date(year, month, day)));
	}
	return out;
}

/**
 * A 6×7 month grid (42 cells) covering the target month, padded with the
 * trailing days of the previous month and leading days of the next.
 */
export function monthGrid(monthAnchor: string, weekStartsOn: WeekStart = 1): CalendarCell[] {
	const start = parseLocalDate(getMonthStart(monthAnchor));
	if (!start) return [];
	const today = getLocalDateString();
	const year = start.getFullYear();
	const month = start.getMonth();

	const firstOfMonth = new Date(year, month, 1);
	const dayOffset = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;
	const gridStart = new Date(year, month, 1 - dayOffset);

	const cells: CalendarCell[] = [];
	for (let i = 0; i < 42; i++) {
		const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
		const dateStr = getLocalDateString(date);
		cells.push({
			date: dateStr,
			day: date.getDate(),
			inMonth: date.getMonth() === month && date.getFullYear() === year,
			isToday: dateStr === today,
			weekday: date.getDay()
		});
	}
	return cells;
}

/** Weekday header labels in display order for the given week start. */
export function weekdayLabels(weekStartsOn: WeekStart = 1): { label: string; index: number }[] {
	const names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
	const out: { label: string; index: number }[] = [];
	for (let i = 0; i < 7; i++) {
		const idx = (weekStartsOn + i) % 7;
		out.push({ label: names[idx], index: idx });
	}
	return out;
}

/**
 * The 7 dates of the week containing `date`, respecting the week start.
 */
export function weekDates(date: string, weekStartsOn: WeekStart = 1): string[] {
	const parsed = parseLocalDate(date);
	if (!parsed) return [];
	const offset = (parsed.getDay() - weekStartsOn + 7) % 7;
	const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() - offset);
	const out: string[] = [];
	for (let i = 0; i < 7; i++) {
		out.push(getLocalDateString(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
	}
	return out;
}

/** Hours 0..23 for a day-view grid. */
export function hourSlots(startHour = 0, endHour = 24): number[] {
	const out: number[] = [];
	for (let h = startHour; h < endHour; h++) out.push(h);
	return out;
}

/** "HH:00" label for an hour. */
export function hourLabel(hour: number): string {
	return `${String(hour).padStart(2, '0')}:00`;
}

export { getWeekdayShort };
