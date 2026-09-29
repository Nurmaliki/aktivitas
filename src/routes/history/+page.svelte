<script lang="ts">
	import type { Activity, ActivityCategory } from '$lib/types/activity';
	import { ACTIVITY_CATEGORIES } from '$lib/types/activity';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { formatDisplayDate } from '$lib/utils/date';
	import { formatDuration } from '$lib/utils/statistics';
	import {
		DEFAULT_FILTER,
		filterActivities,
		isFilterActive,
		type ActivityFilter,
		type SortKey,
		type StatusFilter
	} from '$lib/utils/filter';
	import ActivityList from '$lib/components/ActivityList.svelte';
	import ActivityEditModal from '$lib/components/ActivityEditModal.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	// Filter state (mirrors ActivityFilter).
	let search = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let category = $state<ActivityCategory | 'all'>('all');
	let status = $state<StatusFilter>('all');
	let sort = $state<SortKey>('date-desc');

	// Edit / delete state
	let editing = $state<Activity | null>(null);
	let editOpen = $state(false);
	let deleting = $state<Activity | null>(null);
	let deleteBusy = $state(false);

	const currentFilter = $derived<ActivityFilter>({
		search,
		dateFrom,
		dateTo,
		category,
		status,
		sort
	});

	const hasActiveFilters = $derived(isFilterActive(currentFilter));

	const filtered = $derived(filterActivities(activityStore.activities, currentFilter));

	const totalDuration = $derived(
		filtered.reduce((sum, activity) => sum + activity.duration, 0)
	);

	function resetFilters() {
		search = DEFAULT_FILTER.search;
		dateFrom = DEFAULT_FILTER.dateFrom;
		dateTo = DEFAULT_FILTER.dateTo;
		category = DEFAULT_FILTER.category;
		status = DEFAULT_FILTER.status;
		sort = DEFAULT_FILTER.sort;
	}

	function openEdit(activity: Activity) {
		editing = activity;
		editOpen = true;
	}

	function closeEdit() {
		editOpen = false;
		editing = null;
	}

	function requestDelete(activity: Activity) {
		deleting = activity;
	}

	async function confirmDelete() {
		if (!deleting) return;
		deleteBusy = true;
		await activityStore.remove(deleting.id);
		deleteBusy = false;
		deleting = null;
	}

	async function handleSave(id: string, changes: Parameters<typeof activityStore.update>[1]) {
		const updated = await activityStore.update(id, changes);
		return updated !== null;
	}

	function handleToggle(id: string) {
		void activityStore.toggle(id);
	}

	const groupedByDate = $derived.by(() => {
		const groups = new Map<string, Activity[]>();
		for (const activity of filtered) {
			const bucket = groups.get(activity.date);
			if (bucket) bucket.push(activity);
			else groups.set(activity.date, [activity]);
		}
		// Preserve the order produced by the sort (dates already sorted).
		return [...groups.entries()];
	});
</script>

<svelte:head>
	<title>Riwayat Aktivitas — Daily Activity</title>
	<meta name="description" content="Lihat, cari, dan filter seluruh riwayat aktivitas Anda." />
</svelte:head>

<div class="container page">
	<header class="page-header">
		<h1>Riwayat Aktivitas</h1>
		<p class="subtitle">Seluruh aktivitas Anda dalam satu tempat.</p>
	</header>

	{#if activityStore.error}
		<div class="alert alert-error" role="alert">{activityStore.error}</div>
	{/if}

	<section class="card" aria-labelledby="filters-title">
		<div class="spread">
			<h2 id="filters-title" class="card-title">Cari & Filter</h2>
			{#if hasActiveFilters}
				<button type="button" class="btn btn-ghost btn-sm" onclick={resetFilters}>
					Reset Filter
				</button>
			{/if}
		</div>

		<div class="filter-grid">
			<div class="field span-2">
				<label for="search">Pencarian</label>
				<input
					id="search"
					type="search"
					bind:value={search}
					placeholder="Cari nama atau deskripsi aktivitas…"
					autocomplete="off"
				/>
			</div>

			<div class="field">
				<label for="date-from">Dari tanggal</label>
				<input id="date-from" type="date" bind:value={dateFrom} />
			</div>

			<div class="field">
				<label for="date-to">Sampai tanggal</label>
				<input id="date-to" type="date" bind:value={dateTo} />
			</div>

			<div class="field">
				<label for="category-filter">Kategori</label>
				<select id="category-filter" bind:value={category}>
					<option value="all">Semua kategori</option>
					{#each ACTIVITY_CATEGORIES as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="status-filter">Status</label>
				<select id="status-filter" bind:value={status}>
					<option value="all">Semua</option>
					<option value="completed">Selesai</option>
					<option value="pending">Belum selesai</option>
				</select>
			</div>

			<div class="field">
				<label for="sort">Urutkan</label>
				<select id="sort" bind:value={sort}>
					<option value="date-desc">Tanggal terbaru</option>
					<option value="date-asc">Tanggal terlama</option>
					<option value="name-asc">Nama (A–Z)</option>
					<option value="duration-desc">Durasi terlama</option>
				</select>
			</div>
		</div>
	</section>

	{#if activityStore.loading && !activityStore.initialized}
		<div class="alert alert-info" role="status">Memuat riwayat…</div>
	{:else if activityStore.activities.length === 0}
		<section class="card">
			<ActivityList
				activities={[]}
				emptyTitle="Belum ada riwayat aktivitas."
				emptyMessage="Tambahkan aktivitas dari dashboard untuk mulai mengisi riwayat."
				onToggle={handleToggle}
				onEdit={openEdit}
				onDelete={requestDelete}
			/>
			<div class="empty-cta">
				<a class="btn btn-primary" href="/">Ke Dashboard</a>
			</div>
		</section>
	{:else}
		<section class="card" aria-labelledby="result-title">
			<div class="spread">
				<h2 id="result-title" class="card-title">
					{filtered.length} aktivitas
				</h2>
				<p class="muted text-sm">Total {formatDuration(totalDuration)}</p>
			</div>

			{#if filtered.length === 0}
				<p class="no-results">Tidak ada aktivitas yang cocok dengan filter.</p>
			{:else}
				<div class="history-list">
					{#each groupedByDate as [date, items] (date)}
						<div class="date-group">
							<h3 class="date-heading">{formatDisplayDate(date)}</h3>
							<ActivityList
								activities={items}
								busy={activityStore.saving}
								showDate={false}
								onToggle={handleToggle}
								onEdit={openEdit}
								onDelete={requestDelete}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

<ActivityEditModal
	activity={editing}
	open={editOpen}
	saving={activityStore.saving}
	onSave={handleSave}
	onClose={closeEdit}
/>

<ConfirmDialog
	open={deleting !== null}
	title="Hapus aktivitas?"
	message={deleting
		? `Aktivitas "${deleting.name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
		: ''}
	confirmLabel="Ya, hapus"
	danger
	busy={deleteBusy}
	onConfirm={confirmDelete}
	onCancel={() => (deleting = null)}
/>

<style>
	.filter-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-4);
	}

	.filter-grid .span-2 {
		grid-column: span 2;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin-top: var(--space-4);
	}

	.date-group {
		border-top: 1px solid var(--color-border);
		padding-top: var(--space-3);
	}

	.date-group:first-child {
		border-top: none;
		padding-top: 0;
	}

	.date-heading {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.02em;
		margin-bottom: var(--space-1);
	}

	.no-results {
		margin-top: var(--space-4);
		color: var(--color-text-muted);
		text-align: center;
		padding: var(--space-6) 0;
	}

	.empty-cta {
		display: flex;
		justify-content: center;
		margin-top: var(--space-4);
	}

	@media (max-width: 720px) {
		.filter-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.filter-grid .span-2 {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 480px) {
		.filter-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
