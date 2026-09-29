/**
 * Subtask helpers: creation, counting, reordering and progress.
 *
 * Pure functions so they are trivially testable and reusable by the form, the
 * edit modal and the activity list.
 */

import type { Subtask } from '$lib/types/common';
import { generateId } from '$lib/utils/id';

const MAX_SUBTASK_TITLE = 200;
export const MAX_SUBTASKS = 100;

function newId(): string {
	try {
		return generateId();
	} catch {
		return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}
}

/** Create a subtask positioned at the end of the current list. */
export function createSubtask(title: string, order: number): Subtask {
	return {
		id: newId(),
		title: title.trim().slice(0, MAX_SUBTASK_TITLE),
		completed: false,
		order,
		createdAt: new Date().toISOString()
	};
}

/** Count completed / total subtasks. */
export function subtaskProgress(subtasks: Subtask[] | undefined): {
	completed: number;
	total: number;
	percent: number;
} {
	const list = Array.isArray(subtasks) ? subtasks : [];
	const total = list.length;
	const completed = list.filter((s) => s.completed).length;
	return {
		completed,
		total,
		percent: total === 0 ? 0 : Math.round((completed / total) * 100)
	};
}

/** Toggle a subtask's completed flag (immutably). */
export function toggleSubtask(subtasks: Subtask[] | undefined, id: string): Subtask[] {
	const list = Array.isArray(subtasks) ? subtasks : [];
	return list.map((subtask) =>
		subtask.id === id
			? {
					...subtask,
					completed: !subtask.completed,
					completedAt: !subtask.completed ? new Date().toISOString() : undefined
				}
			: subtask
	);
}

/** Remove a subtask and renumber the remaining ones. */
export function removeSubtask(subtasks: Subtask[] | undefined, id: string): Subtask[] {
	return renumber((subtasks ?? []).filter((subtask) => subtask.id !== id));
}

/** Rename a subtask. */
export function renameSubtask(
	subtasks: Subtask[] | undefined,
	id: string,
	title: string
): Subtask[] {
	return (subtasks ?? []).map((subtask) =>
		subtask.id === id ? { ...subtask, title: title.trim().slice(0, MAX_SUBTASK_TITLE) } : subtask
	);
}

/** Move a subtask one position up (-1) or down (+1), clamping at the ends. */
export function moveSubtask(
	subtasks: Subtask[] | undefined,
	id: string,
	direction: -1 | 1
): Subtask[] {
	const list = [...(subtasks ?? [])].sort((a, b) => a.order - b.order);
	const index = list.findIndex((subtask) => subtask.id === id);
	if (index === -1) return list;
	const target = index + direction;
	if (target < 0 || target >= list.length) return list;
	const next = [...list];
	[next[index], next[target]] = [next[target], next[index]];
	return renumber(next);
}

/** Rewrite `order` to match array position (0-based). */
export function renumber(subtasks: Subtask[]): Subtask[] {
	return subtasks.map((subtask, index) => ({ ...subtask, order: index }));
}
