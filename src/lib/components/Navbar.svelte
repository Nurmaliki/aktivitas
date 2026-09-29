<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/planner', label: 'Planner' },
		{ href: '/calendar', label: 'Kalender' },
		{ href: '/focus', label: 'Fokus' },
		{ href: '/habits', label: 'Kebiasaan' },
		{ href: '/history', label: 'Riwayat' },
		{ href: '/steps', label: 'Langkah' },
		{ href: '/statistics', label: 'Statistik' }
	];

	const current = $derived(page.url.pathname);

	function isActive(href: string): boolean {
		return href === '/' ? current === '/' : current.startsWith(href);
	}
</script>

<header class="navbar">
	<div class="container navbar-inner">
		<a class="brand" href="/" aria-label="Daily Activity Tracker — beranda">
			<span class="brand-mark" aria-hidden="true">✓</span>
			<span class="brand-name">Daily Activity</span>
		</a>
		<nav aria-label="Navigasi utama">
			<ul class="nav-list">
				{#each links as link (link.href)}
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
	</div>
</header>

<style>
	.navbar {
		background-color: var(--color-surface);
		border-bottom: none;
		box-shadow: 0 12px 26px -18px var(--clay-shadow-color);
		position: sticky;
		top: 0;
		z-index: 20;
	}

	.navbar-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		height: 4rem;
	}

	nav {
		min-width: 0;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		text-decoration: none;
		color: var(--color-text);
		font-weight: 900;
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
		background-image: linear-gradient(145deg, #8f81f5, #6f5cec);
		color: #fff;
		font-size: 1rem;
		box-shadow: var(--shadow-clay-sm);
	}

	.brand-name {
		font-size: 1.05rem;
	}

	.nav-list {
		display: flex;
		gap: var(--space-1);
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}

	.nav-list::-webkit-scrollbar {
		display: none;
	}

	.nav-link {
		display: inline-block;
		padding: 0.45rem 0.85rem;
		border-radius: var(--radius-full);
		text-decoration: none;
		color: var(--color-text-muted);
		font-size: 0.9rem;
		font-weight: 700;
		white-space: nowrap;
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			box-shadow 0.15s ease;
	}

	.nav-link:hover {
		background-color: var(--color-surface-alt);
		color: var(--color-text);
	}

	.nav-link.active {
		background-color: var(--color-primary);
		background-image: linear-gradient(145deg, #8f81f5, #6f5cec);
		color: #fff;
		box-shadow: var(--shadow-clay-sm);
	}

	@media (max-width: 480px) {
		.navbar-inner {
			gap: var(--space-2);
			height: 3.5rem;
		}

		.brand-name {
			display: none;
		}

		.nav-link {
			padding: 0.4rem 0.6rem;
			font-size: 0.85rem;
		}
	}
</style>
