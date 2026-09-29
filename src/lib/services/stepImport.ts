/**
 * Parsers for importing step data from external files.
 *
 * This is the pragmatic "bridge" for data exported from health apps
 * (Google Fit, Apple Health, Samsung Health, Garmin, ...). We cannot call those
 * APIs directly from a browser without a backend + OAuth, but users *can*
 * export their data to CSV/JSON and feed it in here.
 *
 * Everything is parsed defensively: unknown shapes are skipped rather than
 * throwing, so a messy export still imports the rows we can understand.
 */

import {
	MAX_STEPS_PER_DAY,
	type StepRecord,
	type StepSource
} from '$lib/types/steps';
import { isValidDateString } from '$lib/utils/date';

export interface StepParseResult {
	valid: boolean;
	error?: string;
	records: StepRecord[];
	/** Rows that were present but could not be understood. */
	skipped: number;
}

function empty(error?: string): StepParseResult {
	return { valid: false, error, records: [], skipped: 0 };
}

/** Clamp/reject a step count coming from an untrusted file. */
function normalizeSteps(value: unknown): number | null {
	let steps: number;
	if (typeof value === 'number') {
		steps = value;
	} else if (typeof value === 'string') {
		// Tolerate "1,234" / "1 234" / "1.234" thousand separators and spaces.
		const cleaned = value.trim().replace(/[\s,_]/g, '');
		// A lone dot could be a thousands separator in some locales; keep digits.
		steps = Number(cleaned);
	} else {
		return null;
	}
	if (!Number.isFinite(steps) || steps < 0) return null;
	return Math.min(MAX_STEPS_PER_DAY, Math.round(steps));
}

/**
 * Normalize a date found in an external file to a local YYYY-MM-DD string.
 * Accepts `YYYY-MM-DD`, `YYYY/MM/DD`, and full ISO timestamps.
 */
function normalizeDate(value: unknown): string | null {
	if (typeof value !== 'string' || value.trim() === '') return null;
	const raw = value.trim();

	const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(raw);
	if (ymd) {
		const candidate = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
		return isValidDateString(candidate) ? candidate : null;
	}

	// Fall back to Date parsing for ISO-ish timestamps.
	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) return null;
	const candidate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(
		parsed.getDate()
	).padStart(2, '0')}`;
	return isValidDateString(candidate) ? candidate : null;
}

/** Candidate keys for the date/steps columns across common export formats. */
const DATE_KEYS = ['date', 'day', 'startDate', 'startdate', 'start_date', 'period', 'timestamp'];
const STEP_KEYS = ['steps', 'step', 'count', 'stepCount', 'step_count', 'totalSteps', 'totalsteps', 'value'];

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
	for (const key of keys) {
		if (key in obj) return obj[key];
	}
	// Case-insensitive second pass.
	const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
	for (const key of keys) {
		const actual = lower.get(key.toLowerCase());
		if (actual) return obj[actual];
	}
	return undefined;
}

/**
 * Parse a JSON file that is either:
 * - an array of step objects, or
 * - an object with `steps` array, or
 * - our own backup format (v2) with a `steps` array.
 */
function parseJson(text: string): StepParseResult {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return empty('File JSON tidak valid.');
	}

	let rows: unknown;
	if (Array.isArray(data)) {
		rows = data;
	} else if (typeof data === 'object' && data !== null) {
		const obj = data as Record<string, unknown>;
		rows = obj.steps ?? obj.data ?? obj.records ?? obj.activities;
	}

	if (!Array.isArray(rows)) {
		return empty('JSON tidak berisi daftar langkah yang dikenali.');
	}

	return collect(rows.map((row) => (typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : null)));
}

/** Split a CSV line, honoring simple double-quoted fields. */
function splitCsvLine(line: string): string[] {
	const cells: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ',' || char === '\t' || char === ';') {
			cells.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	cells.push(current);
	return cells.map((cell) => cell.trim());
}

function parseCsv(text: string): StepParseResult {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length === 0) return empty('File CSV kosong.');

	const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
	const dateIndex = header.findIndex((cell) =>
		DATE_KEYS.some((key) => cell === key.toLowerCase())
	);
	const stepsIndex = header.findIndex((cell) =>
		STEP_KEYS.some((key) => cell === key.toLowerCase())
	);

	// If we can't find named columns, assume `date,steps` positional order.
	const hasHeader = dateIndex !== -1 && stepsIndex !== -1;
	const rows: Record<string, unknown>[] = [];
	const body = hasHeader ? lines.slice(1) : lines;

	for (const line of body) {
		const cells = splitCsvLine(line);
		if (cells.length < 2) continue;
		if (hasHeader) {
			rows.push({ date: cells[dateIndex], steps: cells[stepsIndex] });
		} else {
			rows.push({ date: cells[0], steps: cells[1] });
		}
	}

	if (rows.length === 0) return empty('Tidak ada baris data yang bisa dibaca dari CSV.');

	return collect(rows);
}

/** Turn candidate rows into validated, de-duplicated step records. */
function collect(rows: (Record<string, unknown> | null)[]): StepParseResult {
	const byDate = new Map<string, StepRecord>();
	let skipped = 0;

	for (const row of rows) {
		if (!row) {
			skipped++;
			continue;
		}
		const date = normalizeDate(pick(row, DATE_KEYS));
		const steps = normalizeSteps(pick(row, STEP_KEYS));
		if (!date || steps === null) {
			skipped++;
			continue;
		}
		const existing = byDate.get(date);
		// Last row wins if a source has duplicates (usually the most complete).
		byDate.set(date, {
			date,
			steps,
			source: 'import' as StepSource,
			updatedAt: new Date().toISOString()
		});
		if (existing) skipped++;
	}

	if (byDate.size === 0) {
		return {
			valid: false,
			error:
				'Tidak ada data langkah yang bisa dibaca. Pastikan file memiliki kolom tanggal dan jumlah langkah.',
			records: [],
			skipped
		};
	}

	return {
		valid: true,
		records: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
		skipped
	};
}

/**
 * Parse an arbitrary step-import file. Detects JSON vs CSV automatically.
 * Pure function (no DOM), so it is easy to unit test.
 */
export function parseStepFile(text: string, filename = ''): StepParseResult {
	const trimmed = text.trim();
	if (trimmed === '') return empty('File kosong.');

	const looksJson =
		filename.toLowerCase().endsWith('.json') ||
		(trimmed.startsWith('{') || trimmed.startsWith('['));
	return looksJson ? parseJson(trimmed) : parseCsv(trimmed);
}
