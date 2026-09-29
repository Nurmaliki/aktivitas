import { describe, expect, it } from 'vitest';
import {
	isValidActivity,
	normalizeInput,
	sanitizeText,
	validateActivityInput,
	validateDuration,
	validateName
} from '$lib/utils/validation';
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from '$lib/types/activity';

describe('validateName', () => {
	it('accepts a normal name', () => {
		expect(validateName('Menulis laporan')).toBeNull();
	});

	it('rejects empty and whitespace-only names', () => {
		expect(validateName('')).not.toBeNull();
		expect(validateName('   ')).not.toBeNull();
		expect(validateName('\t\n')).not.toBeNull();
	});

	it('rejects names that are too long', () => {
		expect(validateName('a'.repeat(MAX_NAME_LENGTH + 1))).not.toBeNull();
	});

	it('rejects non-string values', () => {
		expect(validateName(123)).not.toBeNull();
		expect(validateName(null)).not.toBeNull();
	});
});

describe('validateDuration', () => {
	it('accepts positive numbers', () => {
		expect(validateDuration(30)).toBeNull();
		expect(validateDuration(1)).toBeNull();
	});

	it('rejects zero and negatives', () => {
		expect(validateDuration(0)).not.toBeNull();
		expect(validateDuration(-5)).not.toBeNull();
	});

	it('rejects NaN, Infinity and non-numbers', () => {
		expect(validateDuration(NaN)).not.toBeNull();
		expect(validateDuration(Infinity)).not.toBeNull();
		expect(validateDuration(-Infinity)).not.toBeNull();
		expect(validateDuration('abc')).not.toBeNull();
	});

	it('rejects durations beyond 24 hours', () => {
		expect(validateDuration(1441)).not.toBeNull();
		expect(validateDuration(1440)).toBeNull();
	});
});

describe('validateActivityInput', () => {
	const base = {
		name: 'Belajar Svelte',
		description: 'Membaca dokumentasi',
		category: 'Learning',
		date: '2024-03-05',
		duration: 45
	};

	it('accepts a fully valid input', () => {
		const result = validateActivityInput(base);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual({});
	});

	it('rejects an empty name', () => {
		const result = validateActivityInput({ ...base, name: '   ' });
		expect(result.valid).toBe(false);
		expect(result.errors.name).toBeDefined();
	});

	it('rejects duration 0', () => {
		const result = validateActivityInput({ ...base, duration: 0 });
		expect(result.valid).toBe(false);
		expect(result.errors.duration).toBeDefined();
	});

	it('rejects an invalid category', () => {
		const result = validateActivityInput({ ...base, category: 'Napping' });
		expect(result.valid).toBe(false);
		expect(result.errors.category).toBeDefined();
	});

	it('rejects a missing or malformed date', () => {
		expect(validateActivityInput({ ...base, date: '' }).errors.date).toBeDefined();
		expect(validateActivityInput({ ...base, date: '05-03-2024' }).errors.date).toBeDefined();
	});

	it('rejects an over-long description', () => {
		const result = validateActivityInput({
			...base,
			description: 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1)
		});
		expect(result.valid).toBe(false);
		expect(result.errors.description).toBeDefined();
	});

	it('treats a missing description as valid (optional)', () => {
		const result = validateActivityInput({ ...base, description: undefined });
		expect(result.valid).toBe(true);
	});
});

describe('sanitizeText', () => {
	it('trims whitespace', () => {
		expect(sanitizeText('  hello  ', 50)).toBe('hello');
	});

	it('truncates to the maximum length', () => {
		expect(sanitizeText('abcdef', 3)).toBe('abc');
	});

	it('strips control characters', () => {
		expect(sanitizeText('a\u0000b\u001Fc', 50)).toBe('a b c');
	});

	it('returns empty string for non-strings', () => {
		expect(sanitizeText(123, 50)).toBe('');
		expect(sanitizeText(null, 50)).toBe('');
	});
});

describe('normalizeInput', () => {
	it('produces a clean ActivityInput and drops a blank description', () => {
		const input = normalizeInput({
			name: '  Menulis  ',
			description: '   ',
			category: 'Development',
			date: '2024-03-05',
			duration: 30,
			completed: true
		});
		expect(input.name).toBe('Menulis');
		expect(input.description).toBeUndefined();
		expect(input.completed).toBe(true);
		expect(input.category).toBe('Development');
	});

	it('falls back to Other for an unknown category', () => {
		const input = normalizeInput({
			name: 'x',
			category: 'Bogus',
			date: '2024-03-05',
			duration: 10,
			completed: false
		});
		expect(input.category).toBe('Other');
	});
});

describe('isValidActivity', () => {
	const valid = {
		id: 'abc-123',
		name: 'Test',
		category: 'Development',
		date: '2024-03-05',
		duration: 30,
		completed: false,
		createdAt: '2024-03-05T08:00:00.000Z',
		updatedAt: '2024-03-05T08:00:00.000Z'
	};

	it('accepts a well-formed record', () => {
		expect(isValidActivity(valid)).toBe(true);
	});

	it('accepts a record with an optional description', () => {
		expect(isValidActivity({ ...valid, description: 'note' })).toBe(true);
	});

	it('rejects records with missing fields', () => {
		const { name, ...rest } = valid;
		void name;
		expect(isValidActivity(rest)).toBe(false);
	});

	it('rejects a bad category', () => {
		expect(isValidActivity({ ...valid, category: 'Sleeping' })).toBe(false);
	});

	it('rejects a bad date', () => {
		expect(isValidActivity({ ...valid, date: 'not-a-date' })).toBe(false);
	});

	it('rejects a non-positive duration', () => {
		expect(isValidActivity({ ...valid, duration: 0 })).toBe(false);
		expect(isValidActivity({ ...valid, duration: -3 })).toBe(false);
	});

	it('rejects non-object values', () => {
		expect(isValidActivity(null)).toBe(false);
		expect(isValidActivity('x')).toBe(false);
		expect(isValidActivity(42)).toBe(false);
	});
});
