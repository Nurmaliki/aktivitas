<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/history', label: 'Riwayat' },
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
		border-bottom: 1px solid var(--color-border);
		position: sticky;
		top: 0;
		z-index: 20;
	}

	.navbar-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		height: 3.75rem;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		text-decoration: none;
		color: var(--color-text);
		font-weight: 700;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: var(--radius-sm);
		background-color: var(--color-primary);
		color: #fff;
		font-size: 0.85rem;
	}

	.brand-name {
		font-size: 1rem;
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
		font-size: 0.9rem;
		font-weight: 600;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.nav-link:hover {
		background-color: var(--color-surface-alt);
		color: var(--color-text);
	}

	.nav-link.active {
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
	}

	@media (max-width: 480px) {
		.brand-name {
			display: none;
		}
	}
</style>
