import type { Activity, ActivityCategory } from '$lib/types/activity';

export type StatusFilter = 'all' | 'completed' | 'pending';
export type SortKey = 'date-desc' | 'date-asc' | 'name-asc' | 'duration-desc';

export interface ActivityFilter {
	/** Free-text query matched (case-insensitively) against name and description. */
	search: string;
	/** Inclusive lower bound on the local date (YYYY-MM-DD), or '' for none. */
	dateFrom: string;
	/** Inclusive upper bound on the local date (YYYY-MM-DD), or '' for none. */
	dateTo: string;
	category: ActivityCategory | 'all';
	status: StatusFilter;
	sort: SortKey;
}

export const DEFAULT_FILTER: ActivityFilter = {
	search: '',
	dateFrom: '',
	dateTo: '',
	category: 'all',
	status: 'all',
	sort: 'date-desc'
};

/** True when the filter differs from the default state. */
export function isFilterActive(filter: ActivityFilter): boolean {
	return (
		filter.search.trim() !== '' ||
		filter.dateFrom !== '' ||
		filter.dateTo !== '' ||
		filter.category !== 'all' ||
		filter.status !== 'all' ||
		filter.sort !== DEFAULT_FILTER.sort
	);
}

/**
 * Apply search + filters + sorting to a list of activities.
 * Pure function, so the History page and the tests share one implementation.
 */
export function filterActivities(
	activities: Activity[],
	filter: ActivityFilter
): Activity[] {
	const query = filter.search.trim().toLowerCase();

	const result = activities.filter((activity) => {
		if (query) {
			const haystack = `${activity.name} ${activity.description ?? ''}`.toLowerCase();
			if (!haystack.includes(query)) return false;
		}
		if (filter.dateFrom && activity.date < filter.dateFrom) return false;
		if (filter.dateTo && activity.date > filter.dateTo) return false;
		if (filter.category !== 'all' && activity.category !== filter.category) return false;
		if (filter.status === 'completed' && !activity.completed) return false;
		if (filter.status === 'pending' && activity.completed) return false;
		return true;
	});

	return result.sort((a, b) => {
		switch (filter.sort) {
			case 'date-asc':
				return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
			case 'name-asc':
				return a.name.localeCompare(b.name, 'id');
			case 'duration-desc':
				return b.duration - a.duration;
			case 'date-desc':
			default:
				return a.date > b.date ? -1 : a.date < b.date ? 1 : 0;
		}
	});
}
