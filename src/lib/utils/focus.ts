/**
 * Focus / Pomodoro session math.
 *
 * Time is always derived from timestamps — `setInterval` is only used to refresh
 * the UI. This makes the timer reconstructable after a page refresh:
 *
 *   elapsed = now - startedAt - totalPausedMs
 *
 * All functions are pure so they can be unit tested without a real clock.
 */

import type { FocusPhase, FocusSession } from '$lib/types/focus';

export interface CycleConfig {
	focusMinutes: number;
	shortBreakMinutes: number;
	longBreakMinutes: number;
	sessionsBeforeLongBreak: number;
}

export interface TimerState {
	/** Milliseconds elapsed in the current phase, excluding paused time. */
	elapsedMs: number;
	/** Milliseconds remaining in the current phase (0 when done). */
	remainingMs: number;
	/** 0..100 progress within the phase. */
	percent: number;
	/** True when the phase has reached its planned duration. */
	complete: boolean;
}

/**
 * Compute the live timer state for a running/paused session.
 *
 * @param session the persisted focus session
 * @param now current epoch ms (injectable for tests)
 */
export function computeTimer(session: FocusSession, now: number): TimerState {
	const startedAt = Date.parse(session.startedAt);
	const plannedMs = session.plannedMinutes * 60_000;
	if (!Number.isFinite(startedAt) || plannedMs <= 0) {
		return { elapsedMs: 0, remainingMs: 0, percent: 0, complete: true };
	}

	const pauseStartedAt = session.pauseStartedAt ? Date.parse(session.pauseStartedAt) : null;
	// While paused, "now" freezes at the moment the pause began.
	const effectiveNow =
		session.status === 'paused' && pauseStartedAt && Number.isFinite(pauseStartedAt)
			? pauseStartedAt
			: now;

	let elapsed = effectiveNow - startedAt - (session.totalPausedMs || 0);
	if (elapsed < 0) elapsed = 0;

	// A completed/cancelled session stops counting at its planned/actual end.
	if (session.status === 'completed' || session.status === 'cancelled') {
		const capped = Math.min(elapsed, plannedMs);
		return {
			elapsedMs: capped,
			remainingMs: Math.max(0, plannedMs - capped),
			percent: 100,
			complete: true
		};
	}

	const remaining = Math.max(0, plannedMs - elapsed);
	return {
		elapsedMs: elapsed,
		remainingMs: remaining,
		percent: plannedMs === 0 ? 100 : Math.min(100, Math.round((elapsed / plannedMs) * 100)),
		complete: remaining === 0
	};
}

/** Format milliseconds as "MM:SS" (or "H:MM:SS" past an hour). */
export function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const mm = String(minutes).padStart(2, '0');
	const ss = String(seconds).padStart(2, '0');
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Planned minutes for a phase given the cycle config. */
export function phaseMinutes(phase: FocusPhase, config: CycleConfig): number {
	switch (phase) {
		case 'focus':
			return config.focusMinutes;
		case 'shortBreak':
			return config.shortBreakMinutes;
		case 'longBreak':
			return config.longBreakMinutes;
	}
}

/**
 * Determine the next phase after `current`, given how many focus sessions have
 * been completed in the current cycle.
 */
export function nextPhase(current: FocusPhase, completedFocusCount: number, config: CycleConfig): FocusPhase {
	if (current !== 'focus') return 'focus';
	const beforeLong = Math.max(1, config.sessionsBeforeLongBreak);
	return completedFocusCount > 0 && completedFocusCount % beforeLong === 0
		? 'longBreak'
		: 'shortBreak';
}

/** Human label for a phase (Indonesian). */
export function phaseLabel(phase: FocusPhase): string {
	switch (phase) {
		case 'focus':
			return 'Fokus';
		case 'shortBreak':
			return 'Istirahat Pendek';
		case 'longBreak':
			return 'Istirahat Panjang';
	}
}

/** Build a fresh running session object (caller persists it). */
export function buildSession(
	phase: FocusPhase,
	config: CycleConfig,
	now: number,
	activityId?: string,
	activityName?: string
): Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt'> {
	return {
		activityId,
		activityName,
		type: 'pomodoro',
		phase,
		startedAt: new Date(now).toISOString(),
		plannedMinutes: phaseMinutes(phase, config),
		status: 'running',
		totalPausedMs: 0,
		syncStatus: 'pending'
	};
}

/**
 * Reconstruct a session after a refresh: if a running session's phase has
 * already elapsed, mark it complete with the actual elapsed minutes.
 */
export function reconcileSession(session: FocusSession, now: number): FocusSession {
	if (session.status !== 'running' && session.status !== 'paused') return session;
	const state = computeTimer(session, now);
	if (!state.complete) return session;
	return {
		...session,
		status: 'completed',
		endedAt: new Date(now).toISOString(),
		actualMinutes: Math.round(session.plannedMinutes),
		updatedAt: new Date(now).toISOString()
	};
}
