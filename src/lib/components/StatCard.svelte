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
		border: 1px solid var(--color-border);
		border-radius: var(--radius-card);
		box-shadow: none;
		padding: var(--space-4) var(--space-5);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 6.5rem;
		justify-content: center;
	}

	.stat-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--color-text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
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
