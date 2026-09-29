/**
 * Date helpers that always operate on the *local* timezone of the browser.
 *
 * We deliberately avoid `new Date().toISOString().slice(0, 10)` because that
 * returns the UTC calendar date and can be off by one day for users east/west
 * of UTC. All statistics rely on these helpers.
 */

const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
const MONTH_NAMES = [
	'Januari',
	'Februari',
	'Maret',
	'April',
	'Mei',
	'Juni',
	'Juli',
	'Agustus',
	'September',
	'Oktober',
	'November',
	'Desember'
] as const;

function pad(value: number): string {
	return value < 10 ? `0${value}` : String(value);
}

/**
 * Format a Date (or "now") into a local YYYY-MM-DD string.
 */
export function getLocalDateString(date: Date = new Date()): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parse a YYYY-MM-DD string into a Date at *local* midnight.
 * Returns null when the input is not a valid calendar date.
 */
export function parseLocalDate(dateString: string): Date | null {
	if (typeof dateString !== 'string') return null;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim());
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);

	const date = new Date(year, month - 1, day);
	// Guard against overflow like 2024-02-31 -> 2024-03-02.
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}
	return date;
}

/** True when the string is a syntactically valid local date. */
export function isValidDateString(dateString: string): boolean {
	return parseLocalDate(dateString) !== null;
}

/** Add `days` (can be negative) to a local YYYY-MM-DD string. */
export function addDays(dateString: string, days: number): string {	const date = parseLocalDate(dateString);
	if (!date) return dateString;
	date.setDate(date.getDate() + days);
	return getLocalDateString(date);
}

/** Inclusive range of local date strings from `start` to `end`. */
export function getDateRange(start: string, end: string): string[] {
	const startDate = parseLocalDate(start);
	const endDate = parseLocalDate(end);
	if (!startDate || !endDate || startDate > endDate) return [];

	const result: string[] = [];
	const cursor = new Date(startDate);
	while (cursor <= endDate) {
		result.push(getLocalDateString(cursor));
		cursor.setDate(cursor.getDate() + 1);
	}
	return result;
}

/** Array of the last `count` local dates ending today (today last). */
export function getLastNDays(count: number, today: string = getLocalDateString()): string[] {
	return getDateRange(addDays(today, -(count - 1)), today);
}

/**
 * All local dates within the calendar month of `dateString`.
 * Uses the real calendar, so leap years / month lengths are respected.
 */
export function getMonthDates(dateString: string): string[] {
	const date = parseLocalDate(dateString);
	if (!date) return [];
	const year = date.getFullYear();
	const month = date.getMonth();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const dates: string[] = [];
	for (let day = 1; day <= daysInMonth; day++) {
		dates.push(`${year}-${pad(month + 1)}-${pad(day)}`);
	}
	return dates;
}

/** First local date (YYYY-MM-DD) of the month that `dateString` belongs to. */
export function getMonthStart(dateString: string): string {
	const date = parseLocalDate(dateString) ?? new Date();
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

/** Format a Date as local "HH:MM". */
export function formatLocalTime(date: Date = new Date()): string {
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Start of the local day for a Date (00:00:00.000). */
export function startOfLocalDay(date: Date = new Date()): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Format an ISO timestamp as a short local date+time (e.g. "5 Mar 2024, 09:30").
 * Returns an empty string for invalid input.
 */
export function formatLocalDateTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	const day = date.getDate();
	const month = MONTH_NAMES[date.getMonth()];
	return `${day} ${month} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Short weekday label (Sen/Sel/...) for a local YYYY-MM-DD string. */
export function getWeekdayShort(dateString: string): string {
	const date = parseLocalDate(dateString);
	if (!date) return '';
	return WEEKDAY_SHORT[date.getDay()];
}

/** Short human label like "Sen, 12 Mei 2025". */
export function formatDisplayDate(dateString: string): string {
	const date = parseLocalDate(dateString);
	if (!date) return dateString;
	return `${getWeekdayShort(dateString)}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Longer label used in the dashboard header, e.g. "Senin, 12 Mei 2025". */
export function formatHeaderDate(dateString: string = getLocalDateString()): string {
	const date = parseLocalDate(dateString);
	if (!date) return dateString;
	const longDays = [
		'Minggu',
		'Senin',
		'Selasa',
		'Rabu',
		'Kamis',
		'Jumat',
		'Sabtu'
	] as const;
	return `${longDays[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Month + year label like "Mei 2025". */
export function formatMonthLabel(dateString: string): string {
	const date = parseLocalDate(dateString);
	if (!date) return '';
	return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}
