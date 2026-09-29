/**
 * Id generation utility.
 *
 * Lives in `utils/` so both the pure domain helpers (e.g. `utils/subtasks.ts`)
 * and the IndexedDB repositories can use it without the utils layer depending
 * on the repository layer. `repositories/db-core.ts` re-exports it to keep the
 * historical import path working.
 */

/** Generate a UUID, falling back to a manual implementation for older engines. */
export function generateId(): string {
	const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
	if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
		return cryptoObj.randomUUID();
	}
	// RFC4122 v4 fallback using getRandomValues when available.
	if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
		const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}
	// Last resort (non-cryptographic) so the app still functions.
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
