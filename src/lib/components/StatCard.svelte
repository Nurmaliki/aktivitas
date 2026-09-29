<script lang="ts">
	interface Props {
		label: string;
		value: string;
		hint?: string;
		accent?: 'default' | 'primary' | 'success';
	}

	let { label, value, hint, accent = 'default' }: Props = $props();
</script>

<article class="stat-card" class:accent-primary={accent === 'primary'} class:accent-success={accent === 'success'}>
	<p class="stat-label">{label}</p>
	<p class="stat-value">{value}</p>
	{#if hint}
		<p class="stat-hint">{hint}</p>
	{/if}
</article>

<style>
	.stat-card {
		background-color: var(--color-surface);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-clay);
		padding: var(--space-4) var(--space-5);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 6.5rem;
		justify-content: center;
	}

	.stat-label {
		font-size: 0.78rem;
		font-weight: 800;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.stat-value {
		font-size: 1.9rem;
		font-weight: 900;
		line-height: 1.05;
		color: var(--color-text);
	}

	.stat-hint {
		font-size: 0.8rem;
		color: var(--color-text-subtle);
	}

	.accent-primary .stat-value {
		color: var(--color-primary);
	}

	.accent-success .stat-value {
		color: var(--color-success);
	}

	/* On phones the cards sit in a 2-column grid, so trim padding and the big
	   min-height that only makes sense in a wide single row. */
	@media (max-width: 560px) {
		.stat-card {
			padding: var(--space-3) var(--space-4);
			min-height: 5.75rem;
			gap: 0.15rem;
		}

		.stat-value {
			font-size: 1.55rem;
		}

		.stat-label {
			font-size: 0.7rem;
		}
	}
</style>
