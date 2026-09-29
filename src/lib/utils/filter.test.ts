import { describe, expect, it } from 'vitest';
import type { Activity, ActivityCategory } from '$lib/types/activity';
import {
	DEFAULT_FILTER,
	filterActivities,
	isFilterActive,
	type ActivityFilter
} from '$lib/utils/filter';

let seq = 0;
function makeActivity(overrides: Partial<Activity> = {}): Activity {
	seq += 1;
	return {
		id: `id-${seq}`,
		name: `Activity ${seq}`,
		category: 'Development' as ActivityCategory,
		date: '2024-03-05',
		duration: 30,
		completed: false,
		createdAt: `2024-03-05T08:00:${String(seq).padStart(2, '0')}.000Z`,
		updatedAt: '2024-03-05T08:00:00.000Z',
		...overrides
	};
}

function withFilter(overrides: Partial<ActivityFilter>): ActivityFilter {
	return { ...DEFAULT_FILTER, ...overrides };
}

describe('filterActivities — search', () => {
	const activities = [
		makeActivity({ name: 'Menulis dokumentasi' }),
		makeActivity({ name: 'Rapat mingguan', description: 'diskusi sprint' }),
		makeActivity({ name: 'Olahraga pagi' })
	];

	it('matches the name case-insensitively', () => {
		expect(filterActivities(activities, withFilter({ search: 'RAPAT' }))).toHaveLength(1);
		expect(filterActivities(activities, withFilter({ search: 'rapat' }))).toHaveLength(1);
	});

	it('matches the description too', () => {
		expect(filterActivities(activities, withFilter({ search: 'sprint' }))).toHaveLength(1);
	});

	it('ignores surrounding whitespace', () => {
		expect(filterActivities(activities, withFilter({ search: '  olahraga  ' }))).toHaveLength(1);
	});

	it('returns everything for an empty query', () => {
		expect(filterActivities(activities, withFilter({ search: '' }))).toHaveLength(3);
	});

	it('returns nothing when no activity matches', () => {
		expect(filterActivities(activities, withFilter({ search: 'zzz' }))).toHaveLength(0);
	});
});

describe('filterActivities — date range', () => {
	const activities = [
		makeActivity({ date: '2024-03-01' }),
		makeActivity({ date: '2024-03-15' }),
		makeActivity({ date: '2024-03-31' })
	];

	it('applies an inclusive lower bound', () => {
		const result = filterActivities(activities, withFilter({ dateFrom: '2024-03-15' }));
		expect(result.map((a) => a.date)).toEqual(['2024-03-31', '2024-03-15']);
	});

	it('applies an inclusive upper bound', () => {
		const result = filterActivities(activities, withFilter({ dateTo: '2024-03-15' }));
		expect(result.map((a) => a.date)).toEqual(['2024-03-15', '2024-03-01']);
	});

	it('combines both bounds', () => {
		const result = filterActivities(
			activities,
			withFilter({ dateFrom: '2024-03-05', dateTo: '2024-03-20' })
		);
		expect(result.map((a) => a.date)).toEqual(['2024-03-15']);
	});
});

describe('filterActivities — category and status', () => {
	const activities = [
		makeActivity({ category: 'Development', completed: true }),
		makeActivity({ category: 'Learning', completed: false }),
		makeActivity({ category: 'Development', completed: false })
	];

	it('filters by category', () => {
		expect(filterActivities(activities, withFilter({ category: 'Development' }))).toHaveLength(2);
		expect(filterActivities(activities, withFilter({ category: 'Learning' }))).toHaveLength(1);
	});

	it('filters by completed status', () => {
		expect(filterActivities(activities, withFilter({ status: 'completed' }))).toHaveLength(1);
		expect(filterActivities(activities, withFilter({ status: 'pending' }))).toHaveLength(2);
	});

	it('combines search, category and status', () => {
		const result = filterActivities(
			activities,
			withFilter({ category: 'Development', status: 'pending', search: 'activity' })
		);
		expect(result).toHaveLength(1);
		expect(result[0].completed).toBe(false);
	});
});

describe('filterActivities — sorting', () => {
	const activities = [
		makeActivity({ date: '2024-03-01', name: 'Bravo', duration: 30 }),
		makeActivity({ date: '2024-03-10', name: 'Alpha', duration: 90 }),
		makeActivity({ date: '2024-03-05', name: 'Charlie', duration: 60 })
	];

	it('sorts by newest date first (default)', () => {
		const result = filterActivities(activities, withFilter({}));
		expect(result.map((a) => a.date)).toEqual(['2024-03-10', '2024-03-05', '2024-03-01']);
	});

	it('sorts by oldest date first', () => {
		const result = filterActivities(activities, withFilter({ sort: 'date-asc' }));
		expect(result.map((a) => a.date)).toEqual(['2024-03-01', '2024-03-05', '2024-03-10']);
	});

	it('sorts by name A–Z', () => {
		const result = filterActivities(activities, withFilter({ sort: 'name-asc' }));
		expect(result.map((a) => a.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
	});

	it('sorts by duration descending', () => {
		const result = filterActivities(activities, withFilter({ sort: 'duration-desc' }));
		expect(result.map((a) => a.duration)).toEqual([90, 60, 30]);
	});

	it('does not mutate the input array', () => {
		const copy = [...activities];
		filterActivities(activities, withFilter({ sort: 'name-asc' }));
		expect(activities).toEqual(copy);
	});
});

describe('isFilterActive', () => {
	it('is false for the default filter', () => {
		expect(isFilterActive(DEFAULT_FILTER)).toBe(false);
	});

	it('is true when any field changes', () => {
		expect(isFilterActive(withFilter({ search: 'x' }))).toBe(true);
		expect(isFilterActive(withFilter({ category: 'Learning' }))).toBe(true);
		expect(isFilterActive(withFilter({ status: 'pending' }))).toBe(true);
		expect(isFilterActive(withFilter({ dateFrom: '2024-01-01' }))).toBe(true);
		expect(isFilterActive(withFilter({ sort: 'name-asc' }))).toBe(true);
	});

	it('ignores whitespace-only search', () => {
		expect(isFilterActive(withFilter({ search: '   ' }))).toBe(false);
	});
});
