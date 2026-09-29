<script lang="ts">
	interface Props {
		/** 0-100. Values outside the range are clamped. */
		value: number;
		label?: string;
		showLabel?: boolean;
		size?: 'sm' | 'md';
	}

	let { value, label, showLabel = true, size = 'md' }: Props = $props();

	const clamped = $derived(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
</script>

<div class="progress" class:progress-sm={size === 'sm'}>
	{#if showLabel}
		<div class="progress-head">
			<span class="progress-label">{label ?? 'Progress'}</span>
			<span class="progress-value">{clamped}%</span>
		</div>
	{/if}
	<div
		class="progress-track"
		role="progressbar"
		aria-valuenow={clamped}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-label={label ?? 'Progress'}
	>
		<div class="progress-fill" style:width="{clamped}%"></div>
	</div>
</div>

<style>
	.progress {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
	}

	.progress-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.progress-label {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.progress-value {
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.progress-track {
		width: 100%;
		height: 0.5rem;
		background-color: var(--color-border);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.progress-sm .progress-track {
		height: 0.35rem;
	}

	.progress-fill {
		height: 100%;
		background-color: var(--color-primary);
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}
</style>
