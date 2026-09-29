/**
 * Sync types (adapter + feature flag).
 *
 * The app is local-first: IndexedDB is the source of truth and everything works
 * without a backend. Sync is strictly additive and opt-in, enabled only when a
 * remote endpoint is configured through a public (non-secret) env var.
 *
 * The adapter interface is intentionally transport-agnostic so a provider can be
 * swapped without touching the engine or the UI.
 */

import type { SyncEntity, SyncOperation } from '$lib/repositories/syncRepository';

/** A single mutation to push to (or a record pulled from) the backend. */
export interface SyncChange {
	entity: SyncEntity;
	operation: SyncOperation;
	recordId: string;
	/** Record payload for create/update; omitted for delete. */
	payload?: unknown;
	/** ISO timestamp of the mutation (used for last-write-wins conflict checks). */
	updatedAt: string;
}

/** Result returned by a push/pull call. */
export interface SyncPushResult {
	/** Record ids (or `entity:recordId` keys) the backend accepted. */
	accepted: string[];
}

export interface SyncPullResult {
	/** Remote changes to apply locally (already filtered by `since`). */
	changes: SyncChange[];
	/** Server cursor/watermark to send as `since` on the next pull. */
	cursor?: string;
}

/** Pluggable backend transport. Implementations must be pure I/O. */
export interface SyncAdapter {
	/** Stable adapter id, e.g. "noop" or "http". */
	readonly id: string;
	/** Whether this adapter can actually talk to a backend. */
	readonly enabled: boolean;
	push(changes: SyncChange[]): Promise<SyncPushResult>;
	pull(since?: string): Promise<SyncPullResult>;
}

export type SyncState = 'disabled' | 'idle' | 'syncing' | 'error';

export interface SyncStatus {
	state: SyncState;
	/** Adapter id currently in use. */
	adapter: string;
	/** Number of queued local mutations not yet pushed. */
	pending: number;
	/** ISO timestamp of the last successful sync, if any. */
	lastSyncedAt?: string;
	/** Human-readable error from the last failed cycle, if any. */
	error?: string;
}

export interface SyncConfig {
	/** Remote endpoint URL, or undefined for local-only mode. */
	endpoint?: string;
	/** Optional bearer token. NEVER bake secrets into the client bundle. */
	token?: string;
}
