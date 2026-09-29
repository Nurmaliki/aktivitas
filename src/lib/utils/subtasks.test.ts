import { describe, expect, it } from 'vitest';
import {
	MAX_SUBTASKS,
	createSubtask,
	moveSubtask,
	removeSubtask,
	renameSubtask,
	renumber,
	subtaskProgress,
	toggleSubtask
} from './subtasks';
import type { Subtask } from '$lib/types/common';

function make(title: string, order: number, completed = false): Subtask {
	return { id: `id-${order}`, title, completed, order, createdAt: 'x' };
}

describe('createSubtask', () => {
	it('creates a subtask with the given order', () => {
		const s = createSubtask('  Hello  ', 3);
		expect(s.title).toBe('Hello');
		expect(s.order).toBe(3);
		expect(s.completed).toBe(false);
		expect(s.id).toBeTruthy();
	});

	it('truncates very long titles', () => {
		const s = createSubtask('x'.repeat(500), 0);
		expect(s.title.length).toBe(200);
	});
});

describe('subtaskProgress', () => {
	it('returns zeroes for empty/undefined', () => {
		expect(subtaskProgress(undefined)).toEqual({ completed: 0, total: 0, percent: 0 });
		expect(subtaskProgress([])).toEqual({ completed: 0, total: 0, percent: 0 });
	});

	it('computes completed / total / percent', () => {
		const list = [make('a', 0, true), make('b', 1, false), make('c', 2, true), make('d', 3, false)];
		expect(subtaskProgress(list)).toEqual({ completed: 2, total: 4, percent: 50 });
	});

	it('rounds the percentage', () => {
		const list = [make('a', 0, true), make('b', 1, false), make('c', 2, false)];
		expect(subtaskProgress(list).percent).toBe(33);
	});
});

describe('toggleSubtask', () => {
	it('toggles completion and sets completedAt', () => {
		const list = [make('a', 0, false)];
		const next = toggleSubtask(list, 'id-0');
		expect(next[0].completed).toBe(true);
		expect(next[0].completedAt).toBeTruthy();
	});

	it('clears completedAt when un-completing', () => {
		const list = [make('a', 0, true)];
		const next = toggleSubtask(list, 'id-0');
		expect(next[0].completed).toBe(false);
		expect(next[0].completedAt).toBeUndefined();
	});

	it('does not mutate the input', () => {
		const list = [make('a', 0, false)];
		toggleSubtask(list, 'id-0');
		expect(list[0].completed).toBe(false);
	});

	it('returns the list unchanged for an unknown id', () => {
		const list = [make('a', 0)];
		expect(toggleSubtask(list, 'nope')).toEqual(list);
	});

	it('handles undefined input', () => {
		expect(toggleSubtask(undefined, 'x')).toEqual([]);
	});
});

describe('removeSubtask', () => {
	it('removes and renumbers', () => {
		const list = [make('a', 0), make('b', 1), make('c', 2)];
		const next = removeSubtask(list, 'id-1');
		expect(next.map((s) => s.title)).toEqual(['a', 'c']);
		expect(next.map((s) => s.order)).toEqual([0, 1]);
	});
});

describe('renameSubtask', () => {
	it('renames the matching subtask', () => {
		const list = [make('a', 0), make('b', 1)];
		const next = renameSubtask(list, 'id-1', '  renamed ');
		expect(next[1].title).toBe('renamed');
	});
});

describe('moveSubtask', () => {
	it('moves down', () => {
		const list = [make('a', 0), make('b', 1), make('c', 2)];
		const next = moveSubtask(list, 'id-0', 1);
		expect(next.map((s) => s.title)).toEqual(['b', 'a', 'c']);
		expect(next.map((s) => s.order)).toEqual([0, 1, 2]);
	});

	it('moves up', () => {
		const list = [make('a', 0), make('b', 1), make('c', 2)];
		const next = moveSubtask(list, 'id-2', -1);
		expect(next.map((s) => s.title)).toEqual(['a', 'c', 'b']);
	});

	it('clamps at the top', () => {
		const list = [make('a', 0), make('b', 1)];
		expect(moveSubtask(list, 'id-0', -1).map((s) => s.title)).toEqual(['a', 'b']);
	});

	it('clamps at the bottom', () => {
		const list = [make('a', 0), make('b', 1)];
		expect(moveSubtask(list, 'id-1', 1).map((s) => s.title)).toEqual(['a', 'b']);
	});

	it('sorts by order before moving', () => {
		const list = [make('a', 2), make('b', 1), make('c', 0)];
		// Sorted -> [c, b, a]; moving 'a' up swaps it with 'b'.
		const next = moveSubtask(list, 'id-2', -1);
		expect(next.map((s) => s.title)).toEqual(['c', 'a', 'b']);
		expect(next.map((s) => s.order)).toEqual([0, 1, 2]);
	});
});

describe('renumber', () => {
	it('rewrites order to match position', () => {
		const list = [make('a', 5), make('b', 9)];
		expect(renumber(list).map((s) => s.order)).toEqual([0, 1]);
	});
});

describe('MAX_SUBTASKS', () => {
	it('is a sensible cap', () => {
		expect(MAX_SUBTASKS).toBeGreaterThan(0);
	});
});
