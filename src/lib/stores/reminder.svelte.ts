import { browser } from '$app/environment';
import type { Activity } from '$lib/types/activity';
import type { ReminderConfig } from '$lib/types/common';
import { activityStore } from '$lib/stores/activity.svelte.js';
import {
	dueOccurrences,
	type ReminderOccurrence
} from '$lib/services/reminderEngine';
import { getLocalDateString } from '$lib/utils/date';
import {
	notificationPermission,
	playAlarmTone,
	requestNotificationPermission,
	showNotification,
	stopAlarmTone,
	stopVibration,
	vibrate
} from '$lib/services/reminderEffects';

const FIRED_STORAGE_KEY = 'daily-activity:fired-reminders';

/**
 * Central reminder/alarm store.
 *
 * Owns the scheduler tick (kept out of components), the "fired" dedupe set
 * (persisted to localStorage so a refresh does not re-fire the same
 * occurrence) and the AlarmScreen UI state.
 */
class ReminderStore {
	/** The occurrence currently being shown on the AlarmScreen, if any. */
	active = $state<ReminderOccurrence | null>(null);
	/** Queued occurrences waiting behind the active one. */
	queue = $state<ReminderOccurrence[]>([]);
	/** Permission state for system notifications. */
	permission = $state<NotificationPermission | 'unsupported'>('default');
	/** True while sound is playing (for the UI). */
	ringing = $state(false);

	private timer: number | null = null;
	private fired = new Set<string>();

	/** Called once from the layout when running in the browser. */
	start(): void {
		if (!browser || this.timer !== null) return;
		this.fired = loadFired();
		this.permission = notificationPermission();
		// Tick every 20s to catch reminders promptly without busy-looping.
		this.timer = window.setInterval(() => this.tick(), 20_000);
		this.tick();
	}

	stop(): void {
		if (this.timer !== null) {
			window.clearInterval(this.timer);
			this.timer = null;
		}
		// Silence anything currently ringing so a teardown never leaves a tone
		// or vibration looping in the background.
		stopAlarmTone();
		stopVibration();
		this.ringing = false;
		this.active = null;
		this.queue = [];
	}

	async ensurePermission(): Promise<void> {
		this.permission = await requestNotificationPermission();
	}

	/** Evaluate due reminders and surface the next one. */
	tick(): void {
		if (!browser) return;
		const now = Date.now();
		// Catch up on *every* occurrence that is due (wide 24h window), so
		// reminders missed while the tab was suspended are still surfaced.
		const activities = activityStore.activities;
		const due = dueOccurrences(activities, now, this.fired);
		if (due.length > 0) {
			for (const occurrence of due) {
				this.fired.add(occurrence.key);
				this.enqueue(occurrence);
			}
			this.pruneFired(now);
			saveFired(this.fired);
		}
		if (!this.active && this.queue.length > 0) {
			this.present(this.queue.shift()!);
		}
	}

	/**
	 * Drop fired keys older than ~2 days so the dedupe set does not grow and old
	 * keys can never mask a genuinely new occurrence.
	 */
	private pruneFired(now: number): void {
		const cutoff = now - 2 * 24 * 60 * 60 * 1000;
		for (const key of Array.from(this.fired)) {
			// Keys embed a date ("id@YYYY-MM-DDT HH:MM"); parse the trailing date.
			const datePart = key.includes('T') ? key.slice(key.lastIndexOf('@') + 1, key.lastIndexOf('@') + 11) : null;
			if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
				const ts = new Date(`${datePart}T00:00:00`).getTime();
				if (Number.isFinite(ts) && ts < cutoff) this.fired.delete(key);
				continue;
			}
			// Snooze keys embed an ISO timestamp; parse it directly.
			const iso = key.slice(key.lastIndexOf('@') + 1);
			const ts = Date.parse(iso);
			if (Number.isFinite(ts) && ts < cutoff) this.fired.delete(key);
		}
	}

	private enqueue(occurrence: ReminderOccurrence): void {
		if (this.active?.key === occurrence.key) return;
		if (this.queue.some((q) => q.key === occurrence.key)) return;
		this.queue = [...this.queue, occurrence];
	}

	private present(occurrence: ReminderOccurrence): void {
		this.active = occurrence;
		this.ringing = true;
		const activity = activityStore.activities.find((a) => a.id === occurrence.activityId);
		showNotification('Pengingat aktivitas', occurrence.activityName, occurrence.key);
		if (activity?.reminder?.sound !== false) playAlarmTone();
		if (activity?.reminder?.vibration !== false) vibrate();
	}

	/** Dismiss the current alarm and show the next one (if any). */
	dismiss(): void {
		this.clearActive();
	}

	/** Snooze the active alarm by N minutes (persisted on the activity). */
	async snooze(minutes?: number): Promise<void> {
		const current = this.active;
		if (!current) return;
		const mins = minutes ?? current.snoozeMinutes ?? 5;
		const until = new Date(Date.now() + mins * 60_000).toISOString();
		// Detach the active alarm without starting the next one yet, so the
		// persisted write cannot race a new alarm presentation.
		this.detachActive();
		try {
			await activityStore.setReminder(current.activityId, {
				snoozedUntil: until
			} as Partial<Activity>);
		} finally {
			this.presentNext();
		}
	}

	/** "Start now": mark the activity running/completed-ish and dismiss. */
	async startNow(): Promise<void> {
		const current = this.active;
		if (!current) return;
		this.detachActive();
		try {
			await activityStore.setReminder(current.activityId, { status: 'running' } as Partial<Activity>);
		} finally {
			this.presentNext();
		}
	}

	/** Skip the alarm without touching the activity state. */
	skip(): void {
		this.clearActive();
	}

	/** Stop the sound/vibration and clear the active alarm (without advancing). */
	private detachActive(): void {
		stopAlarmTone();
		stopVibration();
		this.ringing = false;
		this.active = null;
	}

	/** Present the next queued alarm, if any. */
	private presentNext(): void {
		if (!this.active && this.queue.length > 0) {
			this.present(this.queue.shift()!);
		}
	}

	private clearActive(): void {
		this.detachActive();
		this.presentNext();
	}

	/** Persist new reminder settings for an activity. */
	async setReminderConfig(activityId: string, config: ReminderConfig): Promise<void> {
		await activityStore.setReminder(activityId, { reminder: config });
	}
}

function loadFired(): Set<string> {
	if (!browser) return new Set();
	try {
		const raw = localStorage.getItem(FIRED_STORAGE_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return new Set(parsed.filter((x) => typeof x === 'string'));
	} catch {
		/* ignore */
	}
	return new Set();
}

function saveFired(set: Set<string>): void {
	if (!browser) return;
	try {
		// Keep the list bounded so localStorage never grows without limit.
		const arr = Array.from(set).slice(-200);
		localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(arr));
	} catch {
		/* ignore */
	}
}

export const reminderStore = new ReminderStore();
