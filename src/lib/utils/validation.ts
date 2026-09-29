import {
	ACTIVITY_CATEGORIES,
	MAX_DESCRIPTION_LENGTH,
	MAX_DURATION_MINUTES,
	MAX_NAME_LENGTH,
	type Activity,
	type ActivityCategory,
	type ActivityInput,
	type ValidationResult
} from '$lib/types/activity';
import { isValidDateString } from '$lib/utils/date';

/** Validate a local time string in "HH:MM" (00:00–23:59). */
export function isValidTimeString(value: unknown): boolean {
	if (typeof value !== 'string') return false;
	const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
	if (!match) return false;
	const hh = Number(match[1]);
	const mm = Number(match[2]);
	return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/** Strip control characters and collapse surrounding whitespace. */
export function sanitizeText(value: unknown, maxLength: number): string {
	if (typeof value !== 'string') return '';
	// Remove control chars (keeps normal text + newlines out of single-line fields).
	const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
	return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/** Validate a single-line name field. */
export function validateName(value: unknown): string | null {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return 'Nama aktivitas wajib diisi.';
	}
	if (value.trim().length > MAX_NAME_LENGTH) {
		return `Nama aktivitas maksimal ${MAX_NAME_LENGTH} karakter.`;
	}
	return null;
}

/** Validate a duration in minutes; rejects NaN, Infinity, negatives and 0. */
export function validateDuration(value: unknown): string | null {
	const duration = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(duration)) {
		return 'Durasi harus berupa angka.';
	}
	if (duration <= 0) {
		return 'Durasi harus lebih dari 0 menit.';
	}
	if (duration > MAX_DURATION_MINUTES) {
		return `Durasi maksimal ${MAX_DURATION_MINUTES} menit (24 jam).`;
	}
	return null;
}

/** Validate the full activity input used by the form. */
export function validateActivityInput(input: {
	name: unknown;
	description?: unknown;
	category: unknown;
	date: unknown;
	duration: unknown;
}): ValidationResult {
	const errors: ValidationResult['errors'] = {};

	const nameError = validateName(input.name);
	if (nameError) errors.name = nameError;

	if (
		input.description != null &&
		typeof input.description === 'string' &&
		input.description.length > MAX_DESCRIPTION_LENGTH
	) {
		errors.description = `Deskripsi maksimal ${MAX_DESCRIPTION_LENGTH} karakter.`;
	}

	if (
		typeof input.category !== 'string' ||
		!ACTIVITY_CATEGORIES.includes(input.category as ActivityCategory)
	) {
		errors.category = 'Kategori tidak valid.';
	}

	if (typeof input.date !== 'string' || !isValidDateString(input.date)) {
		errors.date = 'Tanggal wajib diisi dengan format yang benar.';
	}

	const durationError = validateDuration(input.duration);
	if (durationError) errors.duration = durationError;

	return { valid: Object.keys(errors).length === 0, errors };
}

/** Type guard: is this an ActivityCategory? */
export function isActivityCategory(value: unknown): value is ActivityCategory {
	return typeof value === 'string' && ACTIVITY_CATEGORIES.includes(value as ActivityCategory);
}

/**
 * Validate an unknown value as an Activity record.
 * Used both when reading from IndexedDB and when restoring a backup.
 *
 * Only the core (v1) fields are required; v3 scheduling fields are optional and
 * normalized separately.
 */
export function isValidActivity(value: unknown): value is Activity {
	if (typeof value !== 'object' || value === null) return false;
	const record = value as Record<string, unknown>;

	if (typeof record.id !== 'string' || record.id.trim().length === 0) return false;
	if (validateName(record.name) !== null) return false;
	if (record.description != null && typeof record.description !== 'string') return false;
	if (!isActivityCategory(record.category)) return false;
	if (typeof record.date !== 'string' || !isValidDateString(record.date)) return false;
	if (validateDuration(record.duration) !== null) return false;
	if (typeof record.completed !== 'boolean') return false;
	if (typeof record.createdAt !== 'string' || record.createdAt.length === 0) return false;
	if (typeof record.updatedAt !== 'string' || record.updatedAt.length === 0) return false;

	// Optional v3 fields, when present, must be well-typed.
	if (record.subtasks != null && !Array.isArray(record.subtasks)) return false;
	if (record.startTime != null && !isValidTimeString(record.startTime)) return false;
	if (record.endTime != null && !isValidTimeString(record.endTime)) return false;

	return true;
}

/** Normalize raw (untrusted) activity input into a clean ActivityInput. */
export function normalizeInput(input: {
	name: unknown;
	description?: unknown;
	category: unknown;
	date: unknown;
	duration: unknown;
	completed: unknown;
}): ActivityInput {
	return {
		name: sanitizeText(input.name, MAX_NAME_LENGTH),
		description:
			typeof input.description === 'string' && input.description.trim().length > 0
				? sanitizeText(input.description, MAX_DESCRIPTION_LENGTH)
				: undefined,
		category: isActivityCategory(input.category) ? input.category : 'Other',
		date: typeof input.date === 'string' ? input.date : '',
		duration: typeof input.duration === 'number' ? input.duration : Number(input.duration),
		completed: input.completed === true
	};
}
