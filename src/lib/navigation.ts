/**
 * Shared navigation config.
 *
 * One source of truth for the desktop nav, the mobile bottom bar and the
 * mobile drawer, so routes never drift between layouts.
 *
 * `icon` holds the inner markup of a 24x24 stroke SVG (see NavIcon.svelte).
 */
export interface NavLink {
	href: string;
	label: string;
	/** Short label for the bottom bar on very small screens. */
	shortLabel: string;
	/** Inner paths of a 24x24 stroke icon. */
	icon: string;
	/** Shown in the mobile bottom navigation. */
	primary: boolean;
}

export const NAV_LINKS: NavLink[] = [
	{
		href: '/',
		label: 'Dashboard',
		shortLabel: 'Home',
		primary: true,
		icon: '<path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" />'
	},
	{
		href: '/planner',
		label: 'Planner',
		shortLabel: 'Planner',
		primary: true,
		icon: '<rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M8 3v3M16 3v3M3 9.5h18" /><path d="M7.5 13.5h4M7.5 17h6" />'
	},
	{
		href: '/calendar',
		label: 'Kalender',
		shortLabel: 'Kalender',
		primary: true,
		icon: '<rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M8 3v3M16 3v3M3 9.5h18" /><circle cx="8.5" cy="14" r="1" /><circle cx="12" cy="14" r="1" /><circle cx="15.5" cy="14" r="1" />'
	},
	{
		href: '/focus',
		label: 'Fokus',
		shortLabel: 'Fokus',
		primary: true,
		icon: '<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />'
	},
	{
		href: '/habits',
		label: 'Kebiasaan',
		shortLabel: 'Habit',
		primary: false,
		icon: '<path d="M12 3.5c2.5 2 4 4.4 4 7a4 4 0 0 1-8 0c0-1.4.5-2.7 1.4-3.9" /><path d="M12 20.5c-3.6 0-6.5-2.7-6.5-6.2 0-1 .2-1.9.6-2.8" />'
	},
	{
		href: '/history',
		label: 'Riwayat',
		shortLabel: 'Riwayat',
		primary: false,
		icon: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3.5 4.5V8H7" /><path d="M12 8v4.5l3 1.8" />'
	},
	{
		href: '/steps',
		label: 'Langkah',
		shortLabel: 'Langkah',
		primary: false,
		icon: '<path d="M7 4.5c1.7 0 2.5 1.3 2.5 3.4 0 1.7-.6 3.1-.6 4.6 0 .9.3 1.6 1 2.2" /><path d="M6 20c-1.4 0-2.4-1-2.4-2.6 0-1.2.6-2.4 1.6-3.3" /><path d="M16.5 5.5c1.5 0 2.7 1.1 2.7 3 0 1.6-.6 2.9-.6 4.3 0 1 .3 1.8 1 2.4" /><path d="M15 20c-1.4 0-2.4-1-2.4-2.6 0-1.2.6-2.4 1.6-3.3" />'
	},
	{
		href: '/statistics',
		label: 'Statistik',
		shortLabel: 'Statistik',
		primary: false,
		icon: '<path d="M4 20V10M10 20V4M16 20v-7M20 20H4" />'
	}
];

/** Links rendered directly in the mobile bottom bar (max 4). */
export const BOTTOM_LINKS = NAV_LINKS.filter((link) => link.primary).slice(0, 4);

/** Links that live in the mobile drawer (everything, for the full menu). */
export const DRAWER_LINKS = NAV_LINKS;

/**
 * Route active check. The dashboard ("/") only matches exactly; every other
 * route matches itself and its children.
 */
export function isActiveRoute(current: string, href: string): boolean {
	return href === '/' ? current === '/' : current === href || current.startsWith(`${href}/`);
}
