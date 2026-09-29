export type FocusSessionType = 'pomodoro' | 'stopwatch';

export type FocusSessionStatus = 'running' | 'paused' | 'completed' | 'cancelled';

export type FocusPhase = 'focus' | 'shortBreak' | 'longBreak';

export interface FocusSession {
	id: string;
	/** Optional link back to the activity being worked on. */
	activityId?: string;
	/** Short snapshot of the activity name for resilient display after deletion. */
	activityName?: string;
	type: FocusSessionType;
	/** Which phase of the pomodoro cycle this session represents. */
	phase: FocusPhase;
	/** ISO timestamp. */
	startedAt: string;
	endedAt?: string;
	plannedMinutes: number;
	actualMinutes?: number;
	status: FocusSessionStatus;
	/** ISO timestamp when the current pause began. */
	pauseStartedAt?: string;
	/** Accumulated paused time in ms across all pauses. */
	totalPausedMs: number;
	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
	syncStatus?: 'local' | 'pending' | 'synced' | 'conflict';
}

export interface PomodoroSettings {
	focusMinutes: number;
	shortBreakMinutes: number;
	longBreakMinutes: number;
	sessionsBeforeLongBreak: number;
}

export const DEFAULT_POMODORO: PomodoroSettings = {
	focusMinutes: 25,
	shortBreakMinutes: 5,
	longBreakMinutes: 15,
	sessionsBeforeLongBreak: 4
};

/** Focus sessions in a pomodoro cycle that come before the long break. */
export const MIN_FOCUS_MINUTES = 1;
export const MAX_FOCUS_MINUTES = 180;
