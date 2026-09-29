/**
 * Sync adapter selection (feature flag).
 *
 * The provider is chosen at runtime from PUBLIC env vars. When no endpoint is
 * configured the app runs in local-only mode with a no-op adapter — the
 * production build must succeed with zero sync env vars.
 *
 * IMPORTANT: only `PUBLIC_*` vars are read here; they end up in the client
 * bundle, so they must never carry secrets. A real provider should exchange a
 * short-lived token for access, not embed a long-lived secret.
 */

import type { SyncAdapter, SyncChange, SyncConfig, SyncPullResult, SyncPushResult } from '$lib/types/sync';

/**
 * No-op adapter used in local-only mode. It accepts and discards everything so
 * the rest of the app (queueing, status UI) behaves identically either way.
 */
export const noopAdapter: SyncAdapter = {
	id: 'noop',
	enabled: false,
	async push(changes: SyncChange[]): Promise<SyncPushResult> {
		// Treat everything as "accepted" so the queue drains, mirroring a backend.
		return {
			accepted: changes.map((c) => `${c.entity}:${c.recordId}`)
		};
	},
	async pull(): Promise<SyncPullResult> {
		return { changes: [] };
	}
};

/** Map an env record to a sync config, tolerating absent values. */
export function readSyncConfig(env: Record<string, string | undefined>): SyncConfig {
	const endpoint = env.PUBLIC_SYNC_ENDPOINT?.trim();
	const token = env.PUBLIC_SYNC_TOKEN?.trim();
	return {
		endpoint: endpoint ? endpoint : undefined,
		token: token ? token : undefined
	};
}

/**
 * HTTP adapter: a minimal, documented JSON contract so any backend can
 * implement it.
 *   POST {endpoint}/push  { changes: SyncChange[] }  -> { accepted: string[] }
 *   GET  {endpoint}/pull?since=<cursor>              -> { changes, cursor? }
 */
export function createHttpAdapter(config: SyncConfig): SyncAdapter {
	const base = config.endpoint!.replace(/\/+$/, '');
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (config.token) headers.Authorization = `Bearer ${config.token}`;

	return {
		id: 'http',
		enabled: true,
		async push(changes: SyncChange[]): Promise<SyncPushResult> {
			const res = await fetch(`${base}/push`, {
				method: 'POST',
				headers,
				body: JSON.stringify({ changes })
			});
			if (!res.ok) throw new Error(`Sync push gagal (HTTP ${res.status}).`);
			const body = (await res.json()) as Partial<SyncPushResult>;
			return { accepted: Array.isArray(body?.accepted) ? body.accepted : [] };
		},
		async pull(since?: string): Promise<SyncPullResult> {
			const url = new URL(`${base}/pull`);
			if (since) url.searchParams.set('since', since);
			const res = await fetch(url.toString(), { headers });
			if (!res.ok) throw new Error(`Sync pull gagal (HTTP ${res.status}).`);
			const body = (await res.json()) as Partial<SyncPullResult>;
			return {
				changes: Array.isArray(body?.changes) ? body.changes : [],
				cursor: typeof body?.cursor === 'string' ? body.cursor : undefined
			};
		}
	};
}

/**
 * Select an adapter for the given config. Returns the no-op adapter when sync
 * is not configured or the endpoint is not a valid http(s) URL.
 */
export function selectAdapter(config: SyncConfig): SyncAdapter {
	if (!config.endpoint) return noopAdapter;
	let url: URL;
	try {
		url = new URL(config.endpoint);
	} catch {
		return noopAdapter;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return noopAdapter;
	return createHttpAdapter(config);
}

/** Read the sync config from Vite's `import.meta.env` (public vars only). */
export function syncConfigFromImportMeta(): SyncConfig {
	return readSyncConfig(import.meta.env as unknown as Record<string, string | undefined>);
}
