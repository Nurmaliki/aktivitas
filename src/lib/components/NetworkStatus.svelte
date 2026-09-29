<script lang="ts">
	import { networkStore } from '$lib/stores/network.svelte.js';
</script>

{#if !networkStore.online}
	<div class="net-banner offline" role="status" aria-live="polite">
		<span class="net-dot" aria-hidden="true"></span>
		Mode offline — data tetap tersimpan di perangkat Anda.
	</div>
{/if}

{#if networkStore.updateAvailable}
	<div class="net-banner update" role="status" aria-live="polite">
		<span>Versi baru tersedia.</span>
		<button type="button" class="btn btn-primary btn-sm" onclick={() => networkStore.applyUpdate()}>
			Muat ulang
		</button>
	</div>
{/if}

<style>
	.net-banner {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		justify-content: center;
		font-size: 0.85rem;
		padding: var(--space-2) var(--space-4);
		text-align: center;
	}

	.net-banner.offline {
		background-color: var(--color-warning-soft);
		color: #9a6a14;
		box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.06);
	}

	.net-banner.update {
		background-color: var(--color-primary-soft);
		color: #20639b;
		box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.06);
	}

	.net-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: currentColor;
		flex-shrink: 0;
	}
</style>
