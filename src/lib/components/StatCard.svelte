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
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-4) var(--space-5);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-height: 6.5rem;
		justify-content: center;
	}

	.stat-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.1;
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
</style>
