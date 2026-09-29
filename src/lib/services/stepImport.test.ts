import { describe, expect, it } from 'vitest';
import { parseStepFile } from '$lib/services/stepImport';
import { MAX_STEPS_PER_DAY } from '$lib/types/steps';

describe('parseStepFile — JSON', () => {
	it('parses a bare array of {date, steps}', () => {
		const result = parseStepFile(
			JSON.stringify([
				{ date: '2024-03-01', steps: 5000 },
				{ date: '2024-03-02', steps: 8000 }
			])
		);
		expect(result.valid).toBe(true);
		expect(result.records).toHaveLength(2);
		expect(result.records[0].date).toBe('2024-03-01');
		expect(result.records[0].steps).toBe(5000);
		expect(result.records[0].source).toBe('import');
	});

	it('parses an object with a steps array', () => {
		const result = parseStepFile(
			JSON.stringify({ steps: [{ date: '2024-03-01', steps: 12000 }] })
		);
		expect(result.valid).toBe(true);
		expect(result.records[0].steps).toBe(12000);
	});

	it('parses our own backup format (object with steps)', () => {
		const result = parseStepFile(
			JSON.stringify({
				version: 2,
				activities: [],
				steps: [{ date: '2024-03-01', steps: 3000, source: 'sensor', updatedAt: 'x' }]
			})
		);
		expect(result.valid).toBe(true);
		expect(result.records[0].date).toBe('2024-03-01');
	});

	it('accepts alternate key names (stepCount, startDate)', () => {
		const result = parseStepFile(
			JSON.stringify([{ startDate: '2024-03-05', stepCount: 6543 }])
		);
		expect(result.valid).toBe(true);
		expect(result.records[0].steps).toBe(6543);
	});

	it('accepts full ISO timestamps as the date', () => {
		const result = parseStepFile(
			JSON.stringify([{ timestamp: '2024-03-05T10:00:00.000Z', steps: 1000 }])
		);
		expect(result.valid).toBe(true);
		expect(result.records[0].date).toMatch(/^2024-03-0[45]$/);
	});

	it('rejects invalid JSON', () => {
		const result = parseStepFile('{not json');
		expect(result.valid).toBe(false);
	});

	it('rejects JSON without a recognizable list', () => {
		const result = parseStepFile(JSON.stringify({ hello: 'world' }));
		expect(result.valid).toBe(false);
	});

	it('skips rows with malformed dates or steps but keeps the good ones', () => {
		const result = parseStepFile(
			JSON.stringify([
				{ date: '2024-03-01', steps: 5000 },
				{ date: 'nonsense', steps: 100 },
				{ date: '2024-03-02', steps: -5 },
				{ date: '2024-13-40', steps: 100 }
			])
		);
		expect(result.valid).toBe(true);
		expect(result.records).toHaveLength(1);
		expect(result.skipped).toBe(3);
	});

	it('clamps absurd step counts to the per-day maximum', () => {
		const result = parseStepFile(
			JSON.stringify([{ date: '2024-03-01', steps: 9999999 }])
		);
		expect(result.records[0].steps).toBe(MAX_STEPS_PER_DAY);
	});

	it('de-duplicates the same date, trusting the last row', () => {
		const result = parseStepFile(
			JSON.stringify([
				{ date: '2024-03-01', steps: 1000 },
				{ date: '2024-03-01', steps: 9000 }
			])
		);
		expect(result.records).toHaveLength(1);
		expect(result.records[0].steps).toBe(9000);
	});
});

describe('parseStepFile — CSV', () => {
	it('parses a header-based CSV', () => {
		const csv = 'date,steps\n2024-03-01,5000\n2024-03-02,8000';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.valid).toBe(true);
		expect(result.records).toHaveLength(2);
		expect(result.records[1].steps).toBe(8000);
	});

	it('is case-insensitive about headers', () => {
		const csv = 'Date,Steps\n2024-03-01,5000';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.valid).toBe(true);
		expect(result.records[0].steps).toBe(5000);
	});

	it('handles quoted fields and thousand separators', () => {
		const csv = 'date,steps\n"2024-03-01","1,234"\n"2024-03-02","8 000"';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.records[0].steps).toBe(1234);
		expect(result.records[1].steps).toBe(8000);
	});

	it('falls back to positional date,steps when there is no header', () => {
		const csv = '2024-03-01,4500\n2024-03-02,7000';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.valid).toBe(true);
		expect(result.records).toHaveLength(2);
		expect(result.records[0].steps).toBe(4500);
	});

	it('accepts a semicolon delimiter', () => {
		const csv = 'date;steps\n2024-03-01;5500';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.valid).toBe(true);
		expect(result.records[0].steps).toBe(5500);
	});

	it('rejects an empty CSV', () => {
		expect(parseStepFile('', 'data.csv').valid).toBe(false);
		expect(parseStepFile('   ', 'data.csv').valid).toBe(false);
	});

	it('rejects a CSV with unusable rows', () => {
		const csv = 'date,steps\nnonsense,abc\n';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.valid).toBe(false);
	});

	it('normalizes YYYY/MM/DD dates', () => {
		const csv = 'date,steps\n2024/03/07,6000';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.records[0].date).toBe('2024-03-07');
	});

	it('sorts records ascending by date', () => {
		const csv = 'date,steps\n2024-03-05,6000\n2024-03-01,1000\n2024-03-03,3000';
		const result = parseStepFile(csv, 'data.csv');
		expect(result.records.map((r) => r.date)).toEqual([
			'2024-03-01',
			'2024-03-03',
			'2024-03-05'
		]);
	});
});
