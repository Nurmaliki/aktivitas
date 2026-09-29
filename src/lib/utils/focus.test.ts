import { describe, expect, it } from 'vitest';
import {
	buildSession,
	computeTimer,
	formatClock,
	nextPhase,
	phaseLabel,
	phaseMinutes,
	reconcileSession,
	type CycleConfig
} from './focus';
import type { FocusSession } from '$lib/types/focus';

const config: CycleConfig = {
	focusMinutes: 25,
	shortBreakMinutes: 5,
	longBreakMinutes: 15,
	sessionsBeforeLongBreak: 4
};

function session(partial: Partial<FocusSession>): FocusSession {
	return {
		id: 'f1',
		type: 'pomodoro',
		phase: 'focus',
		startedAt: new Date(2024, 0, 15, 9, 0, 0).toISOString(),
		plannedMinutes: 25,
		status: 'running',
		totalPausedMs: 0,
		createdAt: 'x',
		updatedAt: 'x',
		...partial
	} as FocusSession;
}

const t0 = new Date(2024, 0, 15, 9, 0, 0).getTime();

describe('computeTimer', () => {
	it('counts elapsed time from timestamps', () => {
		const s = session({ startedAt: new Date(t0).toISOString() });
		const state = computeTimer(s, t0 + 5 * 60_000);
		expect(state.elapsedMs).toBe(5 * 60_000);
		expect(state.remainingMs).toBe(20 * 60_000);
		expect(state.percent).toBe(20);
	});

	it('subtracts paused time', () => {
		const s = session({ startedAt: new Date(t0).toISOString(), totalPausedMs: 2 * 60_000 });
		const state = computeTimer(s, t0 + 10 * 60_000);
		expect(state.elapsedMs).toBe(8 * 60_000);
	});

	it('freezes time while paused', () => {
		const pauseAt = new Date(t0 + 3 * 60_000).toISOString();
		const s = session({
			startedAt: new Date(t0).toISOString(),
			status: 'paused',
			pauseStartedAt: pauseAt
		});
		const state = computeTimer(s, t0 + 20 * 60_000);
		expect(state.elapsedMs).toBe(3 * 60_000);
	});

	it('marks complete when the plan is reached', () => {
		const s = session({ startedAt: new Date(t0).toISOString() });
		const state = computeTimer(s, t0 + 26 * 60_000);
		expect(state.complete).toBe(true);
		expect(state.remainingMs).toBe(0);
		expect(state.percent).toBe(100);
	});

	it('clamps negative elapsed', () => {
		const s = session({ startedAt: new Date(t0).toISOString() });
		const state = computeTimer(s, t0 - 60_000);
		expect(state.elapsedMs).toBe(0);
	});
});

describe('formatClock', () => {
	it('formats MM:SS', () => {
		expect(formatClock(0)).toBe('00:00');
		expect(formatClock(65_000)).toBe('01:05');
	});
	it('formats H:MM:SS past an hour', () => {
		expect(formatClock(3_665_000)).toBe('1:01:05');
	});
	it('clamps negatives to zero', () => {
		expect(formatClock(-5)).toBe('00:00');
	});
});

describe('phaseMinutes / phaseLabel', () => {
	it('reads minutes from config', () => {
		expect(phaseMinutes('focus', config)).toBe(25);
		expect(phaseMinutes('shortBreak', config)).toBe(5);
		expect(phaseMinutes('longBreak', config)).toBe(15);
	});
	it('labels phases', () => {
		expect(phaseLabel('focus')).toBe('Fokus');
		expect(phaseLabel('shortBreak')).toBe('Istirahat Pendek');
	});
});

describe('nextPhase', () => {
	it('goes from focus to short break', () => {
		expect(nextPhase('focus', 1, config)).toBe('shortBreak');
	});
	it('goes from focus to long break every 4 sessions', () => {
		expect(nextPhase('focus', 4, config)).toBe('longBreak');
		expect(nextPhase('focus', 8, config)).toBe('longBreak');
	});
	it('returns to focus after any break', () => {
		expect(nextPhase('shortBreak', 1, config)).toBe('focus');
		expect(nextPhase('longBreak', 4, config)).toBe('focus');
	});
});

describe('buildSession', () => {
	it('creates a running session with the phase minutes', () => {
		const s = buildSession('focus', config, t0, 'a1', 'Coding');
		expect(s.status).toBe('running');
		expect(s.plannedMinutes).toBe(25);
		expect(s.activityId).toBe('a1');
		expect(s.activityName).toBe('Coding');
		expect(s.totalPausedMs).toBe(0);
	});
});

describe('reconcileSession', () => {
	it('completes a session whose plan has elapsed', () => {
		const s = session({ startedAt: new Date(t0).toISOString() });
		const result = reconcileSession(s, t0 + 30 * 60_000);
		expect(result.status).toBe('completed');
		expect(result.actualMinutes).toBe(25);
		expect(result.endedAt).toBeTruthy();
	});

	it('leaves a still-running session untouched', () => {
		const s = session({ startedAt: new Date(t0).toISOString() });
		const result = reconcileSession(s, t0 + 5 * 60_000);
		expect(result.status).toBe('running');
	});

	it('ignores non-running sessions', () => {
		const s = session({ status: 'completed' });
		expect(reconcileSession(s, t0 + 999).status).toBe('completed');
	});
});
