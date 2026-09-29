import type { Activity, ActivityCategory } from '$lib/types/activity';
import { ACTIVITY_CATEGORIES } from '$lib/types/activity';
import { formatMonthLabel, getLastNDays, getMonthDates, getWeekdayShort } from '$lib/utils/date';

/** Aggregate numbers for a set of activities. */
export interface ActivityStats {
	total: number;
	completed: number;
	pending: number;
	/** 0-100, rounded. 0 when there are no activities. */
	completionRate: number;
	totalDuration: number;
	completedDuration: number;
	averageDuration: number;
}

/** Stats for a single day inside a multi-day aggregation. */
export interface DailyStats {
	date: string;
	label: string;
	total: number;
	completed: number;
	totalDuration: number;
	completionRate: number;
}

/** Per-category share of the (duration-weighted) total. */
export interface CategoryStats {
	category: ActivityCategory;
	total: number;
	totalDuration: number;
	/** 0-100 share of total duration. */
	percentage: number;
}

/** Monthly roll-up used by the statistics page. */
export interface MonthlyStats {
	monthLabel: string;
	stats: ActivityStats;
	averageActivitiesPerDay: number;
	averageDurationPerActivity: number;
	topCategory: ActivityCategory | null;
	categories: CategoryStats[];
	daily: DailyStats[];
}

/** Completion percentage that never divides by zero. */
export function completionRate(total: number, completed: number): number {
	if (total <= 0) return 0;
	return Math.round((completed / total) * 100);
}

/**
 * Compute aggregate statistics for any list of activities.
 * Pure function so it is trivially unit-testable.
 */
export function computeStats(activities: Activity[]): ActivityStats {
	const total = activities.length;
	if (total === 0) {
		return {
			total: 0,
			completed: 0,
			pending: 0,
			completionRate: 0,
			totalDuration: 0,
			completedDuration: 0,
			averageDuration: 0
		};
	}

	let completed = 0;
	let totalDuration = 0;
	let completedDuration = 0;

	for (const activity of activities) {
		totalDuration += activity.duration;
		if (activity.completed) {
			completed += 1;
			completedDuration += activity.duration;
		}
	}

	return {
		total,
		completed,
		pending: total - completed,
		completionRate: completionRate(total, completed),
		totalDuration,
		completedDuration,
		averageDuration: Math.round(totalDuration / total)
	};
}

/** Stats for a single local date. */
export function getDailyStats(activities: Activity[], date: string): ActivityStats {
	return computeStats(activities.filter((activity) => activity.date === date));
}

/**
 * Aggregate the last `days` days (inclusive of today) into per-day buckets.
 * Dates without activities are still returned with zeroed values so charts have
 * a stable x-axis.
 */
export function getWeeklyStats(
	activities: Activity[],
	days = 7,
	today?: string
): DailyStats[] {
	return getLastNDays(days, today).map((date) => {
		const stats = getDailyStats(activities, date);
		return {
			date,
			label: getWeekdayShort(date),
			total: stats.total,
			completed: stats.completed,
			totalDuration: stats.totalDuration,
			completionRate: stats.completionRate
		};
	});
}

/** Group all activities by category (count + duration + share). */
export function getCategoryStats(activities: Activity[]): CategoryStats[] {
	const counts = new Map<ActivityCategory, { total: number; totalDuration: number }>();
	for (const category of ACTIVITY_CATEGORIES) {
		counts.set(category, { total: 0, totalDuration: 0 });
	}

	let grandDuration = 0;
	for (const activity of activities) {
		const entry = counts.get(activity.category);
		if (entry) {
			entry.total += 1;
			entry.totalDuration += activity.duration;
			grandDuration += activity.duration;
		}
	}

	return ACTIVITY_CATEGORIES.map((category) => {
		const entry = counts.get(category)!;
		return {
			category,
			total: entry.total,
			totalDuration: entry.totalDuration,
			percentage:
				grandDuration > 0 ? Math.round((entry.totalDuration / grandDuration) * 100) : 0
		};
	})
		.filter((entry) => entry.total > 0)
		.sort((a, b) => b.totalDuration - a.totalDuration);
}

/** Month-to-date statistics for the month that `referenceDate` belongs to. */
export function getMonthlyStats(
	activities: Activity[],
	referenceDate: string
): MonthlyStats {
	const monthDates = getMonthDates(referenceDate);
	const dateSet = new Set(monthDates);
	const monthActivities = activities.filter((activity) => dateSet.has(activity.date));

	const stats = computeStats(monthActivities);
	const daily = monthDates.map((date) => {
		const dayStats = getDailyStats(monthActivities, date);
		return {
			date,
			label: String(Number(date.slice(8, 10))),
			total: dayStats.total,
			completed: dayStats.completed,
			totalDuration: dayStats.totalDuration,
			completionRate: dayStats.completionRate
		};
	});

	const categories = getCategoryStats(monthActivities);
	const daysWithData = daily.filter((day) => day.total > 0).length;
	const averageActivitiesPerDay =
		daysWithData > 0
			? Math.round((stats.total / daysWithData) * 10) / 10
			: 0;

	return {
		monthLabel: formatMonthLabel(referenceDate),
		stats,
		averageActivitiesPerDay,
		averageDurationPerActivity: stats.averageDuration,
		topCategory: categories.length > 0 ? categories[0].category : null,
		categories,
		daily
	};
}

/** Format a duration in minutes as "2j 30m" / "45m" / "0m". */
export function formatDuration(minutes: number): string {
	if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	if (hours === 0) return `${remainder}m`;
	if (remainder === 0) return `${hours}j`;
	return `${hours}j ${remainder}m`;
}
