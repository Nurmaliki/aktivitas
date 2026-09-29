import { browser } from '$app/environment';
import { selectAdapter, syncConfigFromImportMeta } from '$lib/services/syncAdapter';
import { readStatus, runSync } from '$lib/services/syncEngine';
import type { SyncAdapter, SyncStatus } from '$lib/types/sync';

/**
 * Sync status store (Svelte 5 runes).
 *
 * Fully feature-flagged: when no sync endpoint is configured the adapter is a
 * no-op, `enabled` is false and the UI shows a clear "local-only" state.
 * Nothing here is required for the app to function.
 */
class SyncStore {
	enabled = $state(false);
	adapterId = $state('noop');
	state = $state<SyncStatus['state']>('disabled');
	pending = $state(0);
	lastSyncedAt = $state<string | undefined>(undefined);
	error = $state<string | undefined>(undefined);
	/** True while a manual/auto sync cycle is running. */
	busy = $state(false);

	private adapter: SyncAdapter = selectAdapter({});
	private started = false;

	init(): void {
		if (!browser || this.started) return;
		this.started = true;
		const config = syncConfigFromImportMeta();
		this.adapter = selectAdapter(config);
		this.enabled = this.adapter.enabled;
		this.adapterId = this.adapter.id;
		void this.refreshStatus();
	}

	/** Re-read queue depth + last sync time from IndexedDB. */
	async refreshStatus(): Promise<void> {
		if (!browser || !this.enabled) return;
		try {
			const status = await readStatus(this.adapter);
			this.pending = status.pending;
			this.lastSyncedAt = status.lastSyncedAt;
			if (!this.busy) this.state = status.state;
		} catch {
			// Status read failures are non-fatal.
		}
	}

	/** Trigger a sync cycle (no-op when disabled). */
	async syncNow(): Promise<void> {
		if (!browser || !this.enabled || this.busy) return;
		this.busy = true;
		this.state = 'syncing';
		this.error = undefined;
		try {
			const result = await runSync(this.adapter);
			if (result.error) {
				this.state = 'error';
				this.error = result.error;
			} else {
				this.state = 'idle';
			}
		} finally {
			this.busy = false;
			await this.refreshStatus();
		}
	}
}

export const syncStore = new SyncStore();
