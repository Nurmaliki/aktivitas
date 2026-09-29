/**
 * Browser-side reminder side-effects: Notification, sound and vibration.
 *
 * All functions are SSR-safe and fail soft: on unsupported/denied platforms
 * they resolve without throwing, so the caller can continue.
 */

import { browser } from '$app/environment';

/** True when the Notification API exists in this browser. */
export function notificationsSupported(): boolean {
	return browser && typeof Notification !== 'undefined';
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
	if (!notificationsSupported()) return 'unsupported';
	return Notification.permission;
}

/** Request permission, returning the resulting state (never throws). */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
	if (!notificationsSupported()) return 'unsupported';
	try {
		return await Notification.requestPermission();
	} catch {
		return Notification.permission;
	}
}

/** Show a system notification when permitted. Returns whether it was shown. */
export function showNotification(title: string, body: string, tag?: string): boolean {
	if (!notificationsSupported() || Notification.permission !== 'granted') return false;
	try {
		new Notification(title, { body, tag, silent: false });
		return true;
	} catch {
		return false;
	}
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (!browser) return null;
	const Ctor =
		typeof AudioContext !== 'undefined'
			? AudioContext
			: (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctor) return null;
	if (!audioContext) audioContext = new Ctor();
	return audioContext;
}

/**
 * Play an alarm tone using the Web Audio API.
 * Autoplay policies may reject this until the user has interacted with the page;
 * failures are swallowed.
 */
export function playAlarmTone(repeats = 3): void {
	const ctx = getAudioContext();
	if (!ctx) return;
	try {
		if (ctx.state === 'suspended') void ctx.resume();
		const now = ctx.currentTime;
		for (let i = 0; i < repeats; i++) {
			const start = now + i * 0.6;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(880, start);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.25, start + 0.05);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
			osc.connect(gain).connect(ctx.destination);
			osc.start(start);
			osc.stop(start + 0.55);
		}
	} catch {
		/* sound is best-effort */
	}
}

export function stopAlarmTone(): void {
	if (!audioContext) return;
	try {
		void audioContext.close();
	} catch {
		/* ignore */
	} finally {
		audioContext = null;
	}
}

/** Trigger device vibration when supported (no-op otherwise). */
export function vibrate(pattern: number | number[] = [200, 100, 200, 100, 400]): void {
	if (!browser || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
		return;
	}
	try {
		navigator.vibrate(pattern);
	} catch {
		/* ignore */
	}
}

export function stopVibration(): void {
	if (!browser || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
		return;
	}
	try {
		navigator.vibrate(0);
	} catch {
		/* ignore */
	}
}
