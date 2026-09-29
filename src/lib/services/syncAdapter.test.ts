import { describe, expect, it } from 'vitest';
import { noopAdapter, readSyncConfig, selectAdapter } from '$lib/services/syncAdapter';

describe('readSyncConfig', () => {
	it('returns undefined endpoint/token when unset', () => {
		const config = readSyncConfig({});
		expect(config.endpoint).toBeUndefined();
		expect(config.token).toBeUndefined();
	});

	it('trims whitespace and keeps real values', () => {
		const config = readSyncConfig({
			PUBLIC_SYNC_ENDPOINT: '  https://example.com/sync  ',
			PUBLIC_SYNC_TOKEN: ' abc '
		});
		expect(config.endpoint).toBe('https://example.com/sync');
		expect(config.token).toBe('abc');
	});

	it('treats empty strings as unset', () => {
		const config = readSyncConfig({ PUBLIC_SYNC_ENDPOINT: '   ', PUBLIC_SYNC_TOKEN: '' });
		expect(config.endpoint).toBeUndefined();
		expect(config.token).toBeUndefined();
	});
});

describe('selectAdapter', () => {
	it('falls back to the no-op adapter when no endpoint is set', () => {
		const adapter = selectAdapter({});
		expect(adapter.id).toBe('noop');
		expect(adapter.enabled).toBe(false);
	});

	it('falls back to no-op for an invalid URL', () => {
		expect(selectAdapter({ endpoint: 'not a url' }).id).toBe('noop');
	});

	it('falls back to no-op for a non-http protocol', () => {
		expect(selectAdapter({ endpoint: 'ftp://example.com' }).id).toBe('noop');
	});

	it('selects the http adapter for a valid http(s) url', () => {
		const adapter = selectAdapter({ endpoint: 'https://example.com/sync' });
		expect(adapter.id).toBe('http');
		expect(adapter.enabled).toBe(true);
	});
});

describe('noopAdapter', () => {
	it('accepts every pushed change and drains the queue', async () => {
		const result = await noopAdapter.push([
			{ entity: 'activity', operation: 'create', recordId: 'a1', updatedAt: 'x' }
		]);
		expect(result.accepted).toEqual(['activity:a1']);
	});

	it('returns no remote changes on pull', async () => {
		const result = await noopAdapter.pull();
		expect(result.changes).toEqual([]);
	});
});
