import { browser } from '$app/environment';
import type { FocusPhase, FocusSession, PomodoroSettings } from '$lib/types/focus';
import { DEFAULT_POMODORO } from '$lib/types/focus';
import * as focusRepo from '$lib/repositories/focusRepository';
import {
	buildSession,
	computeTimer,
	nextPhase,
	reconcileSession
} from '$lib/utils/focus';

/**
 * Focus / Pomodoro store built on Svelte 5 runes.
 *
 * Timer truth comes from timestamps (see `$lib/utils/focus`), so a page refresh
 * reconciles the session from IndexedDB and the clock rather than memory.
 */
class FocusStore {
	/** All persisted focus sessions. */
	sessions = $state<FocusSession[]>([]);
	/** The session currently owning the timer, if any. */
	current = $state<FocusSession | null>(null);
	/** Pomodoro cycle configuration. */
	settings = $state<PomodoroSettings>({ ...DEFAULT_POMODORO });
	loading = $state(false);
	saving = $state(false);
	error = $state<string | null>(null);
	initialized = $state(false);
	/** Ticking clock, refreshed by the UI interval (not a source of truth). */
	now = $state(0);

	private loadPromise: Promise<void> | null = null;
	private ticker: number | null = null;

	async init(force = false): Promise<void> {
		if (!browser || typeof indexedDB === 'undefined') {
			this.initialized = true;
			return;
		}
		if (this.loadPromise && !force) return this.loadPromise;
		this.loading = true;
		this.loadPromise = (async () => {
			try {
				const [sessions, active] = await Promise.all([
					focusRepo.getFocusSessions(),
					focusRepo.getActiveFocusSessions()
				]);
				const now = Date.now();
				// Reconcile any active session against the clock.
				this.sessions = sessions
					.map((session) => reconcileSession(session, now))
					.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
				const stillActive = this.sessions.find(
					(s) => s.status === 'running' || s.status === 'paused'
				);
				this.current = stillActive ?? active[0] ?? null;
				this.now = now;
			} catch (error) {
				this.setError(error, 'Gagal memuat sesi fokus.');
			} finally {
				this.loading = false;
				this.initialized = true;
			}
		})();
		return this.loadPromise;
	}

	/** Start the ticking clock used purely for UI refresh. */
	startClock(): void {
		if (!browser || this.ticker !== null) return;
		this.now = Date.now();
		this.ticker = window.setInterval(() => {
			this.now = Date.now();
		}, 1000);
	}

	stopClock(): void {
		if (this.ticker !== null) {
			window.clearInterval(this.ticker);
			this.ticker = null;
		}
	}

	private setError(error: unknown, fallback: string): void {
		this.error =
			error instanceof Error && error.message ? error.message : fallback;
	}

	clearError(): void {
		this.error = null;
	}

	/** Re-read all focus sessions from IndexedDB (used after import). */
	async refresh(): Promise<void> {
		this.loadPromise = null;
		await this.init(true);
	}

	/** Count of completed focus sessions (used to pick the next break length). */
	focusCount(): number {
		return this.sessions.filter((s) => s.phase === 'focus' && s.status === 'completed').length;
	}

	/** Begin a new session for the given phase. */
	async start(phase: FocusPhase, activityId?: string, activityName?: string): Promise<void> {
		if (this.current) return;
		this.saving = true;
		this.error = null;
		try {
			const draft = buildSession(phase, this.settings, Date.now(), activityId, activityName);
			const created = await focusRepo.addFocusSession(draft);
			this.sessions = [created, ...this.sessions];
			this.current = created;
		} catch (error) {
			this.setError(error, 'Gagal memulai sesi fokus.');
		} finally {
			this.saving = false;
		}
	}

	/** Pause the current session. */
	async pause(): Promise<void> {
		if (!this.current || this.current.status !== 'running') return;
		this.saving = true;
		try {
			const updated = await focusRepo.updateFocusSession(this.current.id, {
				status: 'paused',
				pauseStartedAt: new Date().toISOString()
			});
			this.replace(updated);
		} catch (error) {
			this.setError(error, 'Gagal menjeda sesi.');
		} finally {
			this.saving = false;
		}
	}

	/** Resume the current session, folding the pause into totalPausedMs. */
	async resume(): Promise<void> {
		const current = this.current;
		if (!current || current.status !== 'paused') return;
		this.saving = true;
		try {
			const pausedAt = current.pauseStartedAt ? Date.parse(current.pauseStartedAt) : Date.now();
			const extra = Math.max(0, Date.now() - pausedAt);
			const updated = await focusRepo.updateFocusSession(current.id, {
				status: 'running',
				pauseStartedAt: undefined,
				totalPausedMs: (current.totalPausedMs || 0) + extra
			});
			this.replace(updated);
		} catch (error) {
			this.setError(error, 'Gagal melanjutkan sesi.');
		} finally {
			this.saving = false;
		}
	}

	/** Finish the current session and record actual minutes. */
	async finish(): Promise<void> {
		const current = this.current;
		if (!current) return;
		this.saving = true;
		try {
			const state = computeTimer(current, Date.now());
			const updated = await focusRepo.updateFocusSession(current.id, {
				status: 'completed',
				endedAt: new Date().toISOString(),
				actualMinutes: Math.max(1, Math.round(state.elapsedMs / 60_000)),
				pauseStartedAt: undefined
			});
			this.replace(updated);
			this.current = null;
		} catch (error) {
			this.setError(error, 'Gagal menyelesaikan sesi.');
		} finally {
			this.saving = false;
		}
	}

	/** Cancel the current session without recording focus time. */
	async cancel(): Promise<void> {
		const current = this.current;
		if (!current) return;
		this.saving = true;
		try {
			const updated = await focusRepo.updateFocusSession(current.id, {
				status: 'cancelled',
				endedAt: new Date().toISOString(),
				pauseStartedAt: undefined
			});
			this.replace(updated);
			this.current = null;
		} catch (error) {
			this.setError(error, 'Gagal membatalkan sesi.');
		} finally {
			this.saving = false;
		}
	}

	/** Move to the next phase automatically (called when a phase completes). */
	async advancePhase(): Promise<void> {
		const completed = this.current;
		if (!completed) return;
		// Count completed focus sessions *before* finishing this one.
		const focusCount = this.focusCount();
		const phase = nextPhase(
			completed.phase,
			completed.phase === 'focus' ? focusCount + 1 : focusCount,
			this.settings
		);
		await this.finish();
		await this.start(phase, completed.activityId, completed.activityName);
	}

	updateSettings(changes: Partial<PomodoroSettings>): void {
		this.settings = { ...this.settings, ...changes };
	}

	private replace(session: FocusSession): void {
		this.sessions = this.sessions.map((s) => (s.id === session.id ? session : s));
		this.current = session;
	}
}

export const focusStore = new FocusStore();
