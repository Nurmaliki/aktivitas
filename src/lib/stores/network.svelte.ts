import { browser, dev } from '$app/environment';

/**
 * Online/offline + service-worker status store (Svelte 5 runes).
 *
 * The app is local-first, so "offline" never blocks usage — this store only
 * drives a small status indicator and service-worker registration.
 */
class NetworkStore {
	/** Browser reports an active connection. */
	online = $state(true);
	/** Service worker is registered and controlling this page. */
	swReady = $state(false);
	/** A new service worker version is waiting to activate. */
	updateAvailable = $state(false);

	private started = false;
	private registration: ServiceWorkerRegistration | null = null;
	private handleControllerChange = () => {
		this.swReady = true;
	};

	init(): void {
		if (!browser || this.started) return;
		this.started = true;

		this.online = navigator.onLine;
		window.addEventListener('online', this.handleOnline);
		window.addEventListener('offline', this.handleOffline);

		void this.registerServiceWorker();
	}

	private handleOnline = () => {
		this.online = true;
	};

	private handleOffline = () => {
		this.online = false;
	};

	private async registerServiceWorker(): Promise<void> {
		if (!('serviceWorker' in navigator)) return;
		// Only meaningful in production builds; dev avoids SW caching pitfalls.
		if (dev) return;
		try {
			const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
			this.registration = registration;

			if (navigator.serviceWorker.controller) this.swReady = true;
			navigator.serviceWorker.addEventListener('controllerchange', this.handleControllerChange);

			if (registration.waiting) this.updateAvailable = true;
			registration.addEventListener('updatefound', () => {
				const installing = registration.installing;
				if (!installing) return;
				installing.addEventListener('statechange', () => {
					if (installing.state === 'installed' && navigator.serviceWorker.controller) {
						this.updateAvailable = true;
					}
				});
			});
		} catch {
			// Registration failures are non-fatal; the app works without a SW.
		}
	}

	/** Activate a waiting update and reload once it takes control. */
	applyUpdate(): void {
		const waiting = this.registration?.waiting;
		if (!waiting) {
			if (browser) location.reload();
			return;
		}
		waiting.postMessage('SKIP_WAITING');
		if (browser) {
			navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
				once: true
			});
		}
	}

	destroy(): void {
		if (!browser) return;
		window.removeEventListener('online', this.handleOnline);
		window.removeEventListener('offline', this.handleOffline);
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.removeEventListener(
				'controllerchange',
				this.handleControllerChange
			);
		}
		// Allow a subsequent init() to re-register the listeners.
		this.started = false;
	}
}

export const networkStore = new NetworkStore();
