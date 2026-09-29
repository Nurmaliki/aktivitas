/**
 * Advanced analytics service.
 *
 * Builds on top of `statistics.ts` and `stepStatistics.ts` but adds date ranges
 * (7d/30d/this month/previous month/custom), KPI aggregation, per-day series and
 * deterministic productivity insights (no external AI — all local, explainable).
 */

import type { Activity, ActivityCategory } from '$lib/types/activity';
import type { FocusSession } from '$lib/types/focus';
import type { Habit, HabitLog } from '$lib/types/habit';
import type { StepRecord } from '$lib/types/steps';
import { ACTIVITY_CATEGORIES } from '$lib/types/activity';
import {
	addDays,
	formatMonthLabel,
	getDateRange,
	getLocalDateString,
	getMonthDates,
	getMonthStart,
	getWeekdayShort
} from '$lib/utils/date';
import { getCategoryStats, type CategoryStats } from '$lib/utils/statistics';
import {
	calculateCompletionRate,
	calculateCurrentStreak,
	calculateLongestStreak
} from '$lib/utils/habits';

export type RangePreset = '7d' | '30d' | 'thisMonth' | 'prevMonth' | 'custom';

export interface DateRange {
	from: string;
	to: string;
	label: string;
}

/** Resolve a range preset into concrete local dates. */
export function resolveRange(
	preset: RangePreset,
	today: string = getLocalDateString(),
	custom?: { from: string; to: string }
): DateRange {
	switch (preset) {
		case '7d':
			return { from: addDays(today, -6), to: today, label: '7 hari terakhir' };
		case '30d':
			return { from: addDays(today, -29), to: today, label: '30 hari terakhir' };
		case 'thisMonth': {
			const start = getMonthStart(today);
			return { from: start, to: today, label: `Bulan ini (${formatMonthLabel(today)})` };
		}
		case 'prevMonth': {
			const thisMonthStart = getMonthStart(today);
			const prevAnchor = addDays(thisMonthStart, -1);
			const start = getMonthStart(prevAnchor);
			const dates = getMonthDates(prevAnchor);
			const end = dates[dates.length - 1];
			return { from: start, to: end, label: `Bulan lalu (${formatMonthLabel(prevAnchor)})` };
		}
		case 'custom': {
			const from = custom?.from ?? today;
			const to = custom?.to ?? today;
			return from <= to
				? { from, to, label: `${from} – ${to}` }
				: { from: to, to: from, label: `${to} – ${from}` };
		}
	}
}

export interface RangeKPIs {
	totalActivities: number;
	completed: number;
	missed: number;
	completionRate: number;
	plannedDuration: number;
	actualDuration: number;
	focusedDuration: number;
	plannedVsActualDiff: number;
	averageActivityDuration: number;
	habitCompletionRate: number;
	currentStreak: number;
	longestStreak: number;
	pomodoroSessions: number;
	averageFocusSession: number;
	totalSteps: number;
	averageStepsPerDay: number;
}

export interface DailyPoint {
	date: string;
	label: string;
	total: number;
	completed: number;
	plannedMinutes: number;
	actualMinutes: number;
	focusMinutes: number;
	steps: number;
}

export interface CategoryDistribution {
	category: ActivityCategory;
	count: number;
	duration: number;
	percentage: number;
}

export interface AnalyticsResult {
	range: DateRange;
	kpis: RangeKPIs;
	daily: DailyPoint[];
	categories: CategoryDistribution[];
	insights: Insight[];
}

export interface Insight {
	kind: 'topCategory' | 'bestWeekday' | 'focusAverage' | 'mostMissed' | 'habitTrend' | 'steps';
	text: string;
}

function activitiesInRange(activities: Activity[], range: DateRange): Activity[] {
	return activities.filter((a) => a.date >= range.from && a.date <= range.to);
}

function focusInRange(sessions: FocusSession[], range: DateRange): FocusSession[] {
	return sessions.filter((s) => {
		const day = s.startedAt.slice(0, 10);
		return day >= range.from && day <= range.to;
	});
}

function stepsInRange(steps: StepRecord[], range: DateRange): StepRecord[] {
	return steps.filter((s) => s.date >= range.from && s.date <= range.to);
}

/** Derive status classification (missed) for analytics counting. */
function isMissedActivity(a: Activity, today: string): boolean {
	if (a.completed) return false;
	if (a.status === 'missed') return true;
	if (a.status === 'skipped') return false;
	// Scheduled in the past, still planned -> count as missed.
	return a.date < today && (a.status ?? 'planned') === 'planned';
}

/**
 * Compute the full analytics payload for a range.
 * Pure function; all inputs are plain arrays.
 */
export function computeAnalytics(params: {
	activities: Activity[];
	focusSessions: FocusSession[];
	habits: Habit[];
	habitLogs: HabitLog[];
	steps: StepRecord[];
	range: DateRange;
	today?: string;
}): AnalyticsResult {
	const { range } = params;
	const today = params.today ?? getLocalDateString();

	const activities = activitiesInRange(params.activities, range);
	const focusSessions = focusInRange(params.focusSessions, range);
	const steps = stepsInRange(params.steps, range);

	const completed = activities.filter((a) => a.completed).length;
	const missed = activities.filter((a) => isMissedActivity(a, today)).length;
	const totalActivities = activities.length;

	const plannedDuration = activities.reduce(
		(sum, a) => sum + (a.plannedDuration ?? a.duration ?? 0),
		0
	);
	const actualDuration = activities.reduce(
		(sum, a) => sum + (a.actualDuration ?? (a.completed ? (a.plannedDuration ?? a.duration) : 0)),
		0
	);

	const focusSessionsCompleted = focusSessions.filter(
		(s) => s.phase === 'focus' && s.status === 'completed'
	);
	const focusedDuration = focusSessionsCompleted.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0);

	// Habits: completion across scheduled days in the range.
	let habitScheduled = 0;
	let habitCompleted = 0;
	const rangeDays = getDateRange(range.from, range.to);
	for (const habit of params.habits) {
		if (!habit.active) continue;
		const logs = params.habitLogs.filter((l) => l.habitId === habit.id);
		const done = new Set(logs.filter((l) => l.completed).map((l) => l.date));
		habitCompleted += rangeDays.filter((d) => done.has(d)).length;
		habitScheduled += rangeDays.length; // approximation; refine with schedule below
	}
	// Prefer schedule-aware completion when habits expose frequency.
	let scheduleAware = 0;
	let scheduleDone = 0;
	for (const habit of params.habits) {
		if (!habit.active) continue;
		const logs = params.habitLogs.filter((l) => l.habitId === habit.id);
		const rate = calculateCompletionRate(habit, logs, range.from, range.to);
		if (rate > 0 || logs.length > 0) {
			scheduleAware += 1;
			scheduleDone += rate;
		}
	}
	const habitCompletionRate =
		scheduleAware > 0
			? Math.round(scheduleDone / scheduleAware)
			: habitScheduled > 0
				? Math.round((habitCompleted / habitScheduled) * 100)
				: 0;

	const totalSteps = steps.reduce((sum, s) => sum + s.steps, 0);

	const kpis: RangeKPIs = {
		totalActivities,
		completed,
		missed,
		completionRate: totalActivities === 0 ? 0 : Math.round((completed / totalActivities) * 100),
		plannedDuration,
		actualDuration,
		focusedDuration,
		plannedVsActualDiff: actualDuration - plannedDuration,
		averageActivityDuration:
			totalActivities === 0 ? 0 : Math.round(plannedDuration / totalActivities),
		habitCompletionRate,
		currentStreak: Math.max(0, ...params.habits.map((h) => streakFor(h, params.habitLogs, today))),
		longestStreak: Math.max(0, ...params.habits.map((h) => longestFor(h, params.habitLogs))),
		pomodoroSessions: focusSessionsCompleted.length,
		averageFocusSession:
			focusSessionsCompleted.length === 0
				? 0
				: Math.round(focusedDuration / focusSessionsCompleted.length),
		totalSteps,
		averageStepsPerDay: rangeDays.length === 0 ? 0 : Math.round(totalSteps / rangeDays.length)
	};

	const daily = buildDaily(rangeDays, activities, focusSessionsCompleted, steps);
	const categories = buildCategoryDistribution(activities);
	const insights = buildInsights(activities, focusSessionsCompleted, kpis, daily, categories);

	return { range, kpis, daily, categories, insights };
}

function streakFor(habit: Habit, logs: HabitLog[], today: string): number {
	const subset = logs.filter((l) => l.habitId === habit.id);
	return calculateCurrentStreak(habit, subset, { today });
}

function longestFor(habit: Habit, logs: HabitLog[]): number {
	return calculateLongestStreak(habit, logs.filter((l) => l.habitId === habit.id));
}

function buildDaily(
	days: string[],
	activities: Activity[],
	focusSessions: FocusSession[],
	steps: StepRecord[]
): DailyPoint[] {
	const stepsByDate = new Map(steps.map((s) => [s.date, s.steps]));
	return days.map((date) => {
		const dayActivities = activities.filter((a) => a.date === date);
		const plannedMinutes = dayActivities.reduce(
			(sum, a) => sum + (a.plannedDuration ?? a.duration ?? 0),
			0
		);
		const actualMinutes = dayActivities.reduce(
			(sum, a) =>
				sum + (a.actualDuration ?? (a.completed ? (a.plannedDuration ?? a.duration) : 0)),
			0
		);
		const focusMinutes = focusSessions
			.filter((s) => s.startedAt.slice(0, 10) === date)
			.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0);
		return {
			date,
			label: getWeekdayShort(date),
			total: dayActivities.length,
			completed: dayActivities.filter((a) => a.completed).length,
			plannedMinutes,
			actualMinutes,
			focusMinutes,
			steps: stepsByDate.get(date) ?? 0
		};
	});
}

function buildCategoryDistribution(activities: Activity[]): CategoryDistribution[] {
	const base: CategoryStats[] = getCategoryStats(activities);
	const duration = activities.reduce((s, a) => s + (a.plannedDuration ?? a.duration ?? 0), 0);
	return base.map((entry) => {
		const count = activities.filter((a) => a.category === entry.category).length;
		return {
			category: entry.category,
			count,
			duration: entry.totalDuration,
			percentage: duration > 0 ? Math.round((entry.totalDuration / duration) * 100) : 0
		};
	});
}

function buildInsights(
	activities: Activity[],
	focusSessions: FocusSession[],
	kpis: RangeKPIs,
	daily: DailyPoint[],
	categories: CategoryDistribution[]
): Insight[] {
	const insights: Insight[] = [];

	if (categories.length > 0) {
		const top = categories[0];
		insights.push({
			kind: 'topCategory',
			text: `Kategori dengan durasi terbanyak: ${top.category} (${top.duration} menit).`
		});
	}

	// Best weekday by completion rate (needs a few data points).
	const byWeekday = new Map<string, { total: number; completed: number }>();
	for (const point of daily) {
		const entry = byWeekday.get(point.label) ?? { total: 0, completed: 0 };
		entry.total += point.total;
		entry.completed += point.completed;
		byWeekday.set(point.label, entry);
	}
	let best: { label: string; rate: number } | null = null;
	for (const [label, entry] of byWeekday) {
		if (entry.total < 3) continue;
		const rate = Math.round((entry.completed / entry.total) * 100);
		if (!best || rate > best.rate) best = { label, rate };
	}
	if (best) {
		insights.push({
			kind: 'bestWeekday',
			text: `Hari dengan tingkat penyelesaian tertinggi: ${best.label} (${best.rate}%).`
		});
	}

	if (focusSessions.length > 0) {
		insights.push({
			kind: 'focusAverage',
			text: `Rata-rata waktu fokus: ${kpis.averageFocusSession} menit per sesi (${kpis.focusedDuration} menit total).`
		});
	}

	// Most missed category.
	const missedByCategory = new Map<ActivityCategory, number>();
	for (const activity of activities) {
		if (activity.completed) continue;
		missedByCategory.set(activity.category, (missedByCategory.get(activity.category) ?? 0) + 1);
	}
	let mostMissed: { category: ActivityCategory; count: number } | null = null;
	for (const [category, count] of missedByCategory) {
		if (!mostMissed || count > mostMissed.count) mostMissed = { category, count };
	}
	if (mostMissed && mostMissed.count > 0) {
		insights.push({
			kind: 'mostMissed',
			text: `Kategori paling sering belum selesai: ${mostMissed.category} (${mostMissed.count} aktivitas).`
		});
	}

	if (kpis.habitCompletionRate > 0) {
		insights.push({
			kind: 'habitTrend',
			text: `Konsistensi kebiasaan pada rentang ini: ${kpis.habitCompletionRate}%.`
		});
	}

	if (kpis.totalSteps > 0) {
		insights.push({
			kind: 'steps',
			text: `Rata-rata langkah: ${kpis.averageStepsPerDay.toLocaleString('id-ID')} per hari.`
		});
	}

	return insights;
}

/** Convenience: category list (re-exported for the UI). */
export { ACTIVITY_CATEGORIES };
