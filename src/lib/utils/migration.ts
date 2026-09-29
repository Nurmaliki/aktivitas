/**
 * Migration & normalization layer.
 *
 * IndexedDB records are stored as-is; when read we normalize them into the
 * current schema shape. This keeps legacy v1/v2 records working without a
 * destructive upgrade, and is the single place that knows how old data maps to
 * new data.
 *
 * Rules (data integrity first):
 *  - never mutate/drop a stored record just because a new field is missing;
 *  - derive missing fields with sensible defaults;
 *  - a legacy `completed: true` maps to status 'completed';
 *  - a legacy `duration` maps to both `duration` and `plannedDuration`;
 *  - missing `subtasks` becomes an empty array (not undefined) for new writes.
 */

import type { Activity } from '$lib/types/activity';
import type { ActivityStatus, Priority, Subtask } from '$lib/types/common';
import { DEFAULT_PRIORITY } from '$lib/types/common';

/** Ensure a subtask list is well-formed (used on read and import). */
export function normalizeSubtasks(value: unknown): Subtask[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const result: Subtask[] = [];
	value.forEach((raw, index) => {
		if (typeof raw !== 'object' || raw === null) return;
		const item = raw as Record<string, unknown>;
		const id = typeof item.id === 'string' && item.id.trim() ? item.id : `sub-${index}`;
		if (seen.has(id)) return;
		seen.add(id);
		const title = typeof item.title === 'string' ? item.title.slice(0, 200) : '';
		if (!title.trim()) return;
		result.push({
			id,
			title,
			completed: item.completed === true,
			order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : index,
			createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
			completedAt: typeof item.completedAt === 'string' ? item.completedAt : undefined
		});
	});
	return result.sort((a, b) => a.order - b.order);
}

function normalizePriority(value: unknown): Priority {
	return value === 'low' || value === 'high' || value === 'medium' ? value : DEFAULT_PRIORITY;
}

function normalizeStatus(value: unknown, completed: boolean): ActivityStatus {
	if (value === 'completed' && !completed) return 'completed';
	const valid: ActivityStatus[] = ['planned', 'running', 'paused', 'completed', 'skipped', 'missed'];
	if (typeof value === 'string' && valid.includes(value as ActivityStatus)) {
		return value as ActivityStatus;
	}
	return completed ? 'completed' : 'planned';
}

/**
 * Normalize a single activity record read from IndexedDB or an import file.
 * Assumes the caller already confirmed the core shape is valid.
 */
export function normalizeActivity(record: Activity): Activity {
	const duration = record.duration;
	const plannedDuration =
		typeof record.plannedDuration === 'number' && Number.isFinite(record.plannedDuration)
			? record.plannedDuration
			: duration;
	const completed = record.completed === true;

	return {
		...record,
		plannedDuration,
		priority: normalizePriority(record.priority),
		status: normalizeStatus(record.status, completed),
		subtasks: normalizeSubtasks(record.subtasks),
		// Keep `duration` and `plannedDuration` in sync for legacy consumers.
		duration: plannedDuration,
		completed,
		completedAt:
			typeof record.completedAt === 'string'
				? record.completedAt
				: completed
					? record.updatedAt
					: undefined
	};
}

/** Normalize a list of activities. */
export function normalizeActivities(records: Activity[]): Activity[] {
	return records.map(normalizeActivity);
}

/**
 * Derive whether a scheduled activity that never started should be shown as
 * 'missed'. Pure function so it is testable without a clock dependency.
 *
 * @param status current status
 * @param date activity local date (YYYY-MM-DD)
 * @param endTime optional local end time "HH:MM"
 * @param now reference "now" (injectable for tests)
 */
export function deriveMissed(
	status: ActivityStatus,
	date: string,
	endTime: string | undefined,
	now: Date
): ActivityStatus {
	if (status !== 'planned') return status;
	const boundaryDate = parseLocal(date, endTime);
	if (!boundaryDate) return status;
	return boundaryDate.getTime() < now.getTime() ? 'missed' : status;
}

function parseLocal(date: string, time?: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	let hh = 23;
	let mm = 59;
	if (time) {
		const t = /^(\d{1,2}):(\d{2})$/.exec(time);
		if (t) {
			hh = Number(t[1]);
			mm = Number(t[2]);
		}
	}
	const d = new Date(year, month - 1, day, hh, mm);
	if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
	return d;
}

/** Apply missed-derivation across a list (used by analytics / planner). */
export function applyMissedDerivation(records: Activity[], now: Date): Activity[] {
	return records.map((record) => ({
		...record,
		status: deriveMissed(
			record.status ?? (record.completed ? 'completed' : 'planned'),
			record.date,
			record.endTime,
			now
		)
	}));
}
