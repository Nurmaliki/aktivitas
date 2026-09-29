import { describe, expect, it } from 'vitest';
import { BOTTOM_LINKS, DRAWER_LINKS, NAV_LINKS, isActiveRoute } from '$lib/navigation';

describe('NAV_LINKS', () => {
	it('has unique hrefs and labels', () => {
		const hrefs = NAV_LINKS.map((l) => l.href);
		expect(new Set(hrefs).size).toBe(hrefs.length);
		const labels = NAV_LINKS.map((l) => l.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('exposes an inline SVG icon for every link', () => {
		for (const link of NAV_LINKS) {
			expect(link.icon.trim().length).toBeGreaterThan(0);
			// Only basic shape elements — never <script>/<foreignObject>.
			expect(link.icon).not.toMatch(/<script|onerror|onload|foreignObject/i);
		}
	});

	it('has a short label for the bottom bar', () => {
		for (const link of NAV_LINKS) {
			expect(link.shortLabel.trim().length).toBeGreaterThan(0);
		}
	});

	it('uses absolute route paths starting with a slash', () => {
		for (const link of NAV_LINKS) {
			expect(link.href.startsWith('/')).toBe(true);
		}
	});
});

describe('BOTTOM_LINKS / DRAWER_LINKS', () => {
	it('limits the bottom bar to at most four primary links', () => {
		expect(BOTTOM_LINKS.length).toBeLessThanOrEqual(4);
		expect(BOTTOM_LINKS.every((l) => l.primary)).toBe(true);
	});

	it('exposes every link in the drawer', () => {
		expect(DRAWER_LINKS.length).toBe(NAV_LINKS.length);
	});
});

describe('isActiveRoute', () => {
	it('matches the dashboard only exactly', () => {
		expect(isActiveRoute('/', '/')).toBe(true);
		expect(isActiveRoute('/planner', '/')).toBe(false);
	});

	it('matches a route and its children', () => {
		expect(isActiveRoute('/planner', '/planner')).toBe(true);
		expect(isActiveRoute('/planner/day', '/planner')).toBe(true);
		expect(isActiveRoute('/plannerx', '/planner')).toBe(false);
	});

	it('does not match unrelated routes', () => {
		expect(isActiveRoute('/habits', '/statistics')).toBe(false);
	});
});
