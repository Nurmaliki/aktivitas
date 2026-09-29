import { describe, expect, it } from 'vitest';
import {
	applyMissedDerivation,
	deriveMissed,
	normalizeActivities,
	normalizeActivity,
	normalizeSubtasks
} from './migration';
import type { Activity } from '$lib/types/activity';

const baseLegacy: Activity = {
	id: 'legacy-1',
	name: 'Coding',
	category: 'Development',
	date: '2024-01-15',
	duration: 60,
	completed: false,
	createdAt: '2024-01-15T08:00:00.000Z',
	updatedAt: '2024-01-15T08:00:00.000Z'
};

describe('normalizeActivity', () => {
	it('maps legacy duration to plannedDuration', () => {
		const result = normalizeActivity(baseLegacy);
		expect(result.plannedDuration).toBe(60);
		expect(result.duration).toBe(60);
	});

	it('derives status planned from completed=false', () => {
		const result = normalizeActivity(baseLegacy);
		expect(result.status).toBe('planned');
	});

	it('derives status completed from completed=true', () => {
		const result = normalizeActivity({ ...baseLegacy, completed: true });
		expect(result.status).toBe('completed');
		expect(result.completedAt).toBeTruthy();
	});

	it('fills subtasks with an empty array when missing', () => {
		const result = normalizeActivity(baseLegacy);
		expect(result.subtasks).toEqual([]);
	});

	it('defaults priority to medium', () => {
		const result = normalizeActivity(baseLegacy);
		expect(result.priority).toBe('medium');
	});

	it('preserves an explicit status', () => {
		const result = normalizeActivity({ ...baseLegacy, status: 'missed' });
		expect(result.status).toBe('missed');
	});

	it('preserves new v3 fields', () => {
		const result = normalizeActivity({
			...baseLegacy,
			startTime: '09:00',
			plannedDuration: 30,
			priority: 'high',
			subtasks: [{ id: 's1', title: 'Step', completed: false, order: 0, createdAt: 'x' }]
		});
		expect(result.startTime).toBe('09:00');
		expect(result.plannedDuration).toBe(30);
		expect(result.duration).toBe(30);
		expect(result.priority).toBe('high');
		expect(result.subtasks).toHaveLength(1);
	});
});

describe('normalizeActivities', () => {
	it('normalizes every record', () => {
		const list = normalizeActivities([baseLegacy, { ...baseLegacy, id: '2', completed: true }]);
		expect(list).toHaveLength(2);
		expect(list[0].status).toBe('planned');
		expect(list[1].status).toBe('completed');
	});
});

describe('normalizeSubtasks', () => {
	it('rejects non-arrays', () => {
		expect(normalizeSubtasks(undefined)).toEqual([]);
		expect(normalizeSubtasks('nope')).toEqual([]);
	});

	it('drops malformed entries and keeps valid ones', () => {
		const result = normalizeSubtasks([
			{ id: 'a', title: 'Valid', completed: true, order: 1, createdAt: 'x' },
			{ id: 'b' },
			null,
			{ title: 'No id', completed: false, order: 0, createdAt: 'x' }
		]);
		expect(result.map((s) => s.title)).toEqual(['No id', 'Valid']);
	});

	it('de-duplicates by id', () => {
		const result = normalizeSubtasks([
			{ id: 'a', title: 'One', completed: false, order: 0, createdAt: 'x' },
			{ id: 'a', title: 'Two', completed: false, order: 1, createdAt: 'x' }
		]);
		expect(result).toHaveLength(1);
	});

	it('sorts by order', () => {
		const result = normalizeSubtasks([
			{ id: 'b', title: 'B', completed: false, order: 2, createdAt: 'x' },
			{ id: 'a', title: 'A', completed: false, order: 1, createdAt: 'x' }
		]);
		expect(result.map((s) => s.title)).toEqual(['A', 'B']);
	});
});

describe('deriveMissed', () => {
	const now = new Date(2024, 0, 15, 12, 0);

	it('leaves non-planned statuses untouched', () => {
		expect(deriveMissed('completed', '2024-01-01', '09:00', now)).toBe('completed');
		expect(deriveMissed('skipped', '2024-01-01', '09:00', now)).toBe('skipped');
	});

	it('marks a past planned activity as missed', () => {
		expect(deriveMissed('planned', '2024-01-14', '09:00', now)).toBe('missed');
	});

	it('keeps a future planned activity as planned', () => {
		expect(deriveMissed('planned', '2024-01-16', '09:00', now)).toBe('planned');
	});

	it('keeps today activity planned before end time', () => {
		expect(deriveMissed('planned', '2024-01-15', '18:00', now)).toBe('planned');
	});

	it('marks today activity missed after end time', () => {
		expect(deriveMissed('planned', '2024-01-15', '09:00', now)).toBe('missed');
	});

	it('returns original status on unparseable date', () => {
		expect(deriveMissed('planned', 'not-a-date', '09:00', now)).toBe('planned');
	});
});

describe('applyMissedDerivation', () => {
	it('applies to all records without mutating input', () => {
		const now = new Date(2024, 0, 15, 12, 0);
		const input: Activity[] = [
			{ ...baseLegacy, id: '1', date: '2024-01-01', endTime: '09:00' },
			{ ...baseLegacy, id: '2', date: '2024-01-20', endTime: '09:00' }
		];
		const result = applyMissedDerivation(input, now);
		expect(result[0].status).toBe('missed');
		expect(result[1].status).toBe('planned');
		expect(input[0].status).toBeUndefined();
	});
});
