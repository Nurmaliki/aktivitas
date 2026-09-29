import { describe, expect, it } from 'vitest';
import { computeAnalytics, resolveRange } from './analytics';
import type { Activity } from '$lib/types/activity';
import type { FocusSession } from '$lib/types/focus';
import type { Habit, HabitLog } from '$lib/types/habit';

function act(partial: Partial<Activity> & { id: string; date: string }): Activity {
	return {
		name: 'A',
		category: 'Development',
		duration: 60,
		completed: false,
		createdAt: 'x',
		updatedAt: 'x',
		...partial
	} as Activity;
}

function focus(partial: Partial<FocusSession> & { id: string; startedAt: string }): FocusSession {
	return {
		type: 'pomodoro',
		phase: 'focus',
		plannedMinutes: 25,
		status: 'completed',
		totalPausedMs: 0,
		createdAt: 'x',
		updatedAt: 'x',
		...partial
	} as FocusSession;
}

const habit: Habit = {
	id: 'h1',
	name: 'Water',
	frequency: 'daily',
	targetPerPeriod: 1,
	active: true,
	createdAt: 'x',
	updatedAt: 'x'
};

describe('resolveRange', () => {
	it('7d spans 7 days ending today', () => {
		const r = resolveRange('7d', '2024-01-15');
		expect(r.from).toBe('2024-01-09');
		expect(r.to).toBe('2024-01-15');
	});
	it('30d spans 30 days', () => {
		const r = resolveRange('30d', '2024-01-30');
		expect(r.from).toBe('2024-01-01');
	});
	it('thisMonth starts on the 1st', () => {
		const r = resolveRange('thisMonth', '2024-03-20');
		expect(r.from).toBe('2024-03-01');
		expect(r.to).toBe('2024-03-20');
	});
	it('prevMonth covers the whole previous month', () => {
		const r = resolveRange('prevMonth', '2024-03-10');
		expect(r.from).toBe('2024-02-01');
		expect(r.to).toBe('2024-02-29'); // leap year
	});
	it('custom swaps reversed bounds', () => {
		const r = resolveRange('custom', '2024-01-15', { from: '2024-01-20', to: '2024-01-10' });
		expect(r.from).toBe('2024-01-10');
		expect(r.to).toBe('2024-01-20');
	});
});

describe('computeAnalytics', () => {
	const range = { from: '2024-01-15', to: '2024-01-17', label: 'test' };

	it('aggregates activity KPIs', () => {
		const activities = [
			act({ id: '1', date: '2024-01-15', completed: true, duration: 60 }),
			act({ id: '2', date: '2024-01-16', completed: false, duration: 30 }),
			act({ id: '3', date: '2024-01-17', completed: true, duration: 90 })
		];
		const result = computeAnalytics({
			activities,
			focusSessions: [],
			habits: [],
			habitLogs: [],
			steps: [],
			range,
			today: '2024-01-20'
		});
		expect(result.kpis.totalActivities).toBe(3);
		expect(result.kpis.completed).toBe(2);
		expect(result.kpis.completionRate).toBe(67);
		expect(result.kpis.plannedDuration).toBe(180);
	});

	it('excludes activities outside the range', () => {
		const activities = [
			act({ id: '1', date: '2024-01-15' }),
			act({ id: '2', date: '2024-02-01' })
		];
		const result = computeAnalytics({
			activities,
			focusSessions: [],
			habits: [],
			habitLogs: [],
			steps: [],
			range,
			today: '2024-01-20'
		});
		expect(result.kpis.totalActivities).toBe(1);
	});

	it('counts missed scheduled activities in the past', () => {
		const activities = [act({ id: '1', date: '2024-01-15', completed: false, status: 'planned' })];
		const result = computeAnalytics({
			activities,
			focusSessions: [],
			habits: [],
			habitLogs: [],
			steps: [],
			range,
			today: '2024-01-20'
		});
		expect(result.kpis.missed).toBe(1);
	});

	it('aggregates focus sessions', () => {
		const sessions = [
			focus({ id: 'f1', startedAt: '2024-01-15T09:00:00.000Z', actualMinutes: 25 }),
			focus({ id: 'f2', startedAt: '2024-01-16T09:00:00.000Z', actualMinutes: 25 }),
			focus({ id: 'f3', startedAt: '2024-01-16T10:00:00.000Z', phase: 'shortBreak', status: 'completed' })
		];
		// Use local dates: startedAt.slice(0,10) must fall in range.
		const local = sessions.map((s) => ({
			...s,
			startedAt: new Date(s.startedAt).toISOString()
		}));
		const result = computeAnalytics({
			activities: [],
			focusSessions: local,
			habits: [],
			habitLogs: [],
			steps: [],
			range: { from: '2024-01-01', to: '2024-12-31', label: 'year' },
			today: '2024-01-20'
		});
		expect(result.kpis.pomodoroSessions).toBe(2);
		expect(result.kpis.focusedDuration).toBe(50);
		expect(result.kpis.averageFocusSession).toBe(25);
	});

	it('computes habit completion rate over scheduled days', () => {
		const logs: HabitLog[] = [
			{ id: 'l1', habitId: 'h1', date: '2024-01-15', completed: true, updatedAt: 'x' },
			{ id: 'l2', habitId: 'h1', date: '2024-01-17', completed: true, updatedAt: 'x' }
		];
		const result = computeAnalytics({
			activities: [],
			focusSessions: [],
			habits: [habit],
			habitLogs: logs,
			steps: [],
			range,
			today: '2024-01-17'
		});
		// 3 days in range, 2 completed -> rounds to 67.
		expect(result.kpis.habitCompletionRate).toBe(67);
	});

	it('builds a per-day series with stable length', () => {
		const result = computeAnalytics({
			activities: [act({ id: '1', date: '2024-01-16', completed: true, duration: 45 })],
			focusSessions: [],
			habits: [],
			habitLogs: [],
			steps: [],
			range,
			today: '2024-01-20'
		});
		expect(result.daily).toHaveLength(3);
		const day16 = result.daily.find((d) => d.date === '2024-01-16')!;
		expect(day16.total).toBe(1);
		expect(day16.plannedMinutes).toBe(45);
	});

	it('builds category distribution sorted by duration', () => {
		const activities = [
			act({ id: '1', date: '2024-01-15', category: 'Meeting', duration: 30 }),
			act({ id: '2', date: '2024-01-16', category: 'Development', duration: 120 })
		];
		const result = computeAnalytics({
			activities,
			focusSessions: [],
			habits: [],
			habitLogs: [],
			steps: [],
			range,
			today: '2024-01-20'
		});
		expect(result.categories[0].category).toBe('Development');
		expect(result.categories[0].duration).toBe(120);
	});

	it('produces deterministic insights', () => {
		const activities = [
			act({ id: '1', date: '2024-01-15', category: 'Development', completed: true }),
			act({ id: '2', date: '2024-01-16', category: 'Exercise', completed: false })
		];
		const result = computeAnalytics({
			activities,
			focusSessions: [focus({ id: 'f1', startedAt: '2024-01-15T09:00:00.000Z', actualMinutes: 25 })],
			habits: [],
			habitLogs: [],
			steps: [],
			range: { from: '2024-01-01', to: '2024-12-31', label: 'year' },
			today: '2024-01-20'
		});
		expect(result.insights.some((i) => i.kind === 'topCategory')).toBe(true);
		expect(result.insights.some((i) => i.kind === 'mostMissed')).toBe(true);
	});

	it('handles an empty dataset without dividing by zero', () => {
		const result = computeAnalytics({
			activities: [],
			focusSessions: [],
			habits: [],
			habitLogs: [],
			steps: [],
			range,
			today: '2024-01-20'
		});
		expect(result.kpis.completionRate).toBe(0);
		expect(result.kpis.averageActivityDuration).toBe(0);
		expect(result.kpis.averageFocusSession).toBe(0);
		expect(result.categories).toEqual([]);
	});
});
