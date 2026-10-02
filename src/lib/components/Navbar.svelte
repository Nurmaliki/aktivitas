<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import NavIcon from '$lib/components/NavIcon.svelte';
	import {
		BOTTOM_LINKS,
		DRAWER_LINKS,
		isActiveRoute,
		type NavLink
	} from '$lib/navigation';

	const current = $derived(page.url.pathname);

	function isActive(href: string): boolean {
		return isActiveRoute(current, href);
	}

	// Mobile drawer state.
	let drawerOpen = $state(false);
	let drawerEl = $state<HTMLElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);

	function openDrawer() {
		drawerOpen = true;
	}

	function closeDrawer() {
		drawerOpen = false;
		// Return focus to the trigger for keyboard users.
		if (browser) triggerEl?.focus();
	}

	// Close on Escape while the drawer is open.
	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && drawerOpen) {
			event.preventDefault();
			closeDrawer();
		}
	}

	// Close the drawer whenever the route changes.
	$effect(() => {
		// Track `current` so navigating closes the drawer.
		void current;
		drawerOpen = false;
	});

	// Lock body scroll while the drawer is open.
	$effect(() => {
		if (!browser) return;
		if (drawerOpen) {
			const prev = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = prev;
			};
		}
	});

	// Move focus into the drawer when it opens.
	$effect(() => {
		if (drawerOpen && browser) {
			requestAnimationFrame(() => drawerEl?.focus());
		}
	});

	// The bottom bar shows 4 primary items plus a "More" button.
	const moreActive = $derived(
		DRAWER_LINKS.some((link: NavLink) => !link.primary && isActive(link.href))
	);
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Top bar: brand + desktop nav + mobile hamburger -->
<header class="navbar">
	<div class="container navbar-inner">
		<a class="brand" href="/" aria-label="Daily Activity Tracker — beranda">
			<span class="brand-mark" aria-hidden="true">✓</span>
			<span class="brand-name">Daily Activity</span>
		</a>

		<!-- Desktop navigation -->
		<nav class="desktop-nav" aria-label="Navigasi utama">
			<ul class="nav-list">
				{#each DRAWER_LINKS as link (link.href)}
					<li>
						<a
							href={link.href}
							class="nav-link"
							class:active={isActive(link.href)}
							aria-current={isActive(link.href) ? 'page' : undefined}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<!-- Mobile hamburger -->
		<button
			type="button"
			class="hamburger"
			aria-label="Buka menu navigasi"
			aria-haspopup="dialog"
			aria-expanded={drawerOpen}
			bind:this={triggerEl}
			onclick={openDrawer}
		>
			<span class="hamburger-line" aria-hidden="true"></span>
			<span class="hamburger-line" aria-hidden="true"></span>
			<span class="hamburger-line" aria-hidden="true"></span>
		</button>
	</div>
</header>

<!-- Mobile drawer + backdrop -->
{#if drawerOpen}
	<div
		class="drawer-backdrop"
		role="presentation"
		onclick={closeDrawer}
	></div>
{/if}

<div
	bind:this={drawerEl}
	class="drawer"
	class:open={drawerOpen}
	role="dialog"
	aria-modal="true"
	aria-label="Menu navigasi"
	tabindex="-1"
	inert={!drawerOpen}
>
	<div class="drawer-header">
		<span class="drawer-title">Menu</span>
		<button
			type="button"
			class="drawer-close"
			aria-label="Tutup menu"
			onclick={closeDrawer}
		>
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
				<path d="M6 6l12 12M18 6L6 18" />
			</svg>
		</button>
	</div>

	<nav aria-label="Menu lengkap">
		<ul class="drawer-list">
			{#each DRAWER_LINKS as link (link.href)}
				<li>
					<a
						href={link.href}
						class="drawer-link"
						class:active={isActive(link.href)}
						aria-current={isActive(link.href) ? 'page' : undefined}
						onclick={closeDrawer}
					>
						<span class="drawer-link-icon" aria-hidden="true">
							<NavIcon paths={link.icon} size={22} />
						</span>
						{link.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>

<!-- Mobile bottom navigation -->
<nav class="bottom-nav" aria-label="Navigasi utama seluler">
	<ul class="bottom-list">
		{#each BOTTOM_LINKS as link (link.href)}
			<li>
				<a
					href={link.href}
					class="bottom-link"
					class:active={isActive(link.href)}
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					<span class="bottom-icon" aria-hidden="true">
						<NavIcon paths={link.icon} size={22} />
					</span>
					<span class="bottom-label">{link.shortLabel}</span>
				</a>
			</li>
		{/each}
		<li>
			<button
				type="button"
				class="bottom-link"
				class:active={moreActive}
				aria-label="Menu lainnya"
				aria-haspopup="dialog"
				onclick={openDrawer}
			>
				<span class="bottom-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="5" cy="12" r="1.6" />
						<circle cx="12" cy="12" r="1.6" />
						<circle cx="19" cy="12" r="1.6" />
					</svg>
				</span>
				<span class="bottom-label">Lainnya</span>
			</button>
		</li>
	</ul>
</nav>

<style>
	/* ---------- Top bar ---------- */
	.navbar {
		background-color: rgba(255, 255, 255, 0.92);
		border-bottom: 1px solid var(--color-border);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		position: sticky;
		top: 0;
		z-index: 20;
	}

	.navbar-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		height: 3.5rem;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		text-decoration: none;
		color: var(--color-text);
		font-weight: 700;
		flex-shrink: 0;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-md);
		background-color: var(--color-primary);
		color: #fff;
		font-size: 1rem;
	}

	.brand-name {
		font-size: 0.95rem;
		letter-spacing: -0.01em;
	}

	/* ---------- Desktop nav ---------- */
	.desktop-nav {
		min-width: 0;
	}

	.nav-list {
		display: flex;
		gap: var(--space-1);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.nav-link {
		display: inline-block;
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text-muted);
		font-size: 0.85rem;
		font-weight: 500;
		white-space: nowrap;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.nav-link:hover {
		background-color: var(--color-surface-alt);
		color: var(--color-text);
	}

	.nav-link.active {
		background-color: var(--color-primary-soft);
		color: #075985;
		font-weight: 600;
	}

	/* ---------- Hamburger ---------- */
	.hamburger {
		display: none;
		flex-direction: column;
		justify-content: center;
		gap: 5px;
		width: 2.5rem;
		height: 2.5rem;
		padding: 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		cursor: pointer;
		flex-shrink: 0;
	}

	.hamburger-line {
		display: block;
		height: 2px;
		width: 100%;
		border-radius: var(--radius-full);
		background-color: var(--color-text-muted);
	}

	/* ---------- Drawer ---------- */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(2px);
		z-index: 40;
		animation: fade-in 0.18s ease;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100dvh;
		width: min(20rem, 82vw);
		background-color: var(--color-surface);
		border-left: 1px solid var(--color-border);
		box-shadow: var(--shadow-lg);
		z-index: 50;
		padding: var(--space-4);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		transform: translateX(100%);
		transition: transform 0.24s ease;
	}

	.drawer.open {
		transform: translateX(0);
	}

	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.drawer-title {
		font-size: 1rem;
		font-weight: 700;
	}

	.drawer-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.drawer-close:hover {
		background-color: var(--color-surface-alt);
	}

	.drawer-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.drawer-link {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 0.6rem 0.7rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text);
		font-weight: 500;
		font-size: 0.925rem;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.drawer-link:hover {
		background-color: var(--color-surface-alt);
	}

	.drawer-link.active {
		background-color: var(--color-primary-soft);
		color: #075985;
		font-weight: 600;
	}

	.drawer-link-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-md);
		background-color: var(--color-surface-alt);
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.drawer-link.active .drawer-link-icon {
		background-color: rgba(2, 132, 199, 0.14);
		color: var(--color-primary);
	}

	/* ---------- Bottom nav ---------- */
	.bottom-nav {
		display: none;
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		background-color: rgba(255, 255, 255, 0.96);
		border-top: 1px solid var(--color-border);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		padding: 0.35rem 0.5rem calc(0.35rem + env(safe-area-inset-bottom, 0px));
	}

	.bottom-list {
		display: flex;
		align-items: stretch;
		justify-content: space-around;
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.bottom-list > li {
		flex: 1;
		display: flex;
	}

	.bottom-link {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 0.35rem 0.2rem;
		border: none;
		background: none;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: var(--color-text-subtle);
		font: inherit;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.bottom-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.4rem;
		height: 1.75rem;
		border-radius: var(--radius-full);
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.bottom-label {
		font-size: 0.65rem;
		font-weight: 500;
		letter-spacing: 0.01em;
	}

	.bottom-link.active {
		color: var(--color-primary);
	}

	.bottom-link.active .bottom-label {
		font-weight: 600;
	}

	.bottom-link.active .bottom-icon {
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
	}

	/* ---------- Responsive switches ---------- */
	@media (max-width: 899px) {
		.desktop-nav {
			display: none;
		}

		.hamburger {
			display: flex;
		}

		.bottom-nav {
			display: block;
		}

		.navbar-inner {
			height: 3.25rem;
		}
	}

	@media (max-width: 420px) {
		.brand-name {
			font-size: 0.9rem;
		}

		.bottom-label {
			font-size: 0.6rem;
		}
	}

	/* Hide bottom nav on the huge-screen case only if needed (kept visible
	   up to 899px; desktops get the inline nav instead). */
	@media (min-width: 900px) {
		.drawer,
		.drawer-backdrop {
			display: none;
		}
	}
</style>
