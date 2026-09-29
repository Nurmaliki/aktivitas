<script lang="ts">
	import { syncStore } from '$lib/stores/sync.svelte.js';
	import { networkStore } from '$lib/stores/network.svelte.js';
	import { formatLocalDateTime } from '$lib/utils/date';

	let lastSyncLabel = $derived(
		syncStore.lastSyncedAt ? formatLocalDateTime(syncStore.lastSyncedAt) : 'Belum pernah'
	);

	const stateLabel = $derived(
		{
			disabled: 'Lokal saja',
			idle: 'Siap',
			syncing: 'Menyinkronkan…',
			error: 'Gagal'
		}[syncStore.state]
	);
</script>

<section class="card" aria-labelledby="sync-title">
	<div class="spread">
		<h2 id="sync-title">Sinkronisasi</h2>
		<span class="state-badge" data-state={syncStore.state}>{stateLabel}</span>
	</div>

	{#if !syncStore.enabled}
		<p class="hint">
			Sinkronisasi cloud tidak aktif. Aplikasi berjalan <strong>lokal saja</strong> — semua data
			disimpan aman di perangkat Anda dan tetap berfungsi tanpa internet. Untuk mengaktifkan,
			atur variabel lingkungan <code>PUBLIC_SYNC_ENDPOINT</code> saat build.
		</p>
	{:else}
		<dl class="sync-meta">
			<div>
				<dt>Adapter</dt>
				<dd>{syncStore.adapterId}</dd>
			</div>
			<div>
				<dt>Menunggu dikirim</dt>
				<dd>{syncStore.pending}</dd>
			</div>
			<div>
				<dt>Sinkron terakhir</dt>
				<dd>{lastSyncLabel}</dd>
			</div>
		</dl>

		{#if syncStore.error}
			<p class="error-text" role="alert">{syncStore.error}</p>
		{/if}

		<button
			type="button"
			class="btn btn-primary"
			disabled={syncStore.busy || !networkStore.online}
			onclick={() => syncStore.syncNow()}
		>
			{syncStore.busy ? 'Menyinkronkan…' : 'Sinkronkan sekarang'}
		</button>
		{#if !networkStore.online}
			<p class="hint">Tidak dapat menyinkronkan saat offline — data akan dikirim saat kembali online.</p>
		{/if}
	{/if}
</section>

<style>
	.state-badge {
		font-size: 0.8rem;
		padding: 0.2rem 0.7rem;
		border-radius: var(--radius-full);
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
		font-weight: 700;
	}

	.state-badge[data-state='error'] {
		background-color: var(--color-danger-soft);
		color: var(--color-danger);
	}

	.state-badge[data-state='disabled'] {
		background-color: var(--color-surface-alt);
		color: var(--color-text-subtle);
	}

	.sync-meta {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--space-3);
		margin: var(--space-3) 0;
	}

	.sync-meta dt {
		font-size: 0.8rem;
		color: var(--color-text-subtle);
	}

	.sync-meta dd {
		margin: 0;
		font-weight: 600;
	}

	.hint {
		color: var(--color-text-subtle);
		font-size: 0.9rem;
		margin: var(--space-2) 0;
	}

	.error-text {
		color: var(--color-danger);
		font-size: 0.9rem;
	}
</style>
