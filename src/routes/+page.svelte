<script lang="ts">
	import { onMount } from 'svelte';
	import type { Activity, ActivityInput } from '$lib/types/activity';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { stepStore } from '$lib/stores/steps.svelte.js';
	import { getLocalDateString, formatHeaderDate } from '$lib/utils/date';
	import { computeStats, formatDuration, getWeeklyStats } from '$lib/utils/statistics';
	import { goalProgress } from '$lib/utils/stepStatistics';
	import ActivityForm from '$lib/components/ActivityForm.svelte';
	import ActivityList from '$lib/components/ActivityList.svelte';
	import ActivityEditModal from '$lib/components/ActivityEditModal.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import WeeklyChart from '$lib/components/WeeklyChart.svelte';
	import StepCounterCard from '$lib/components/StepCounterCard.svelte';

	// `today` is set on the client so the date always reflects the user's locale.
	let today = $state('');
	let formSection = $state<HTMLElement | null>(null);

	onMount(() => {
		today = getLocalDateString();
	});

	const todaysActivities = $derived(today ? activityStore.byDate(today) : []);
	const todayStats = $derived(computeStats(todaysActivities));
	const weeklyStats = $derived(getWeeklyStats(activityStore.activities, 7, today || undefined));
	const allStats = $derived(computeStats(activityStore.activities));

	// Steps today (0 until the store has loaded on the client).
	const todaySteps = $derived(today ? stepStore.stepsFor(today) : 0);
	const stepsProgress = $derived(goalProgress(todaySteps, stepStore.goal));

	// Edit modal state
	let editing = $state<Activity | null>(null);
	let editOpen = $state(false);

	// Delete confirmation state
	let deleting = $state<Activity | null>(null);
	let deleteBusy = $state(false);

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

	async function handleAdd(input: ActivityInput): Promise<boolean> {
		const created = await activityStore.add(input);
		return created !== null;
	}

	async function handleSave(id: string, changes: ActivityInput): Promise<boolean> {
		const updated = await activityStore.update(id, changes);
		return updated !== null;
	}

	function handleToggle(id: string) {
		void activityStore.toggle(id);
	}

	function handleSubtasksChange(id: string, subtasks: import('$lib/types/common').Subtask[]) {
		void activityStore.updateSubtasks(id, subtasks);
	}

	function scrollToForm() {
		formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		formSection?.querySelector<HTMLInputElement>('input')?.focus();
	}
</script>

<svelte:head>
	<title>Daily Activity — Dashboard</title>
	<meta
		name="description"
		content="Catat dan pantau aktivitas harian Anda beserta statistiknya."
	/>
</svelte:head>

<div class="container page">
	<header class="page-header">
		<h1>Daily Activity</h1>
		<p class="subtitle">Pantau aktivitas dan produktivitas harian Anda.</p>
		<p class="today">Hari ini: {today ? formatHeaderDate(today) : '—'}</p>
	</header>

	{#if activityStore.error}
		<div class="alert alert-error" role="alert">
			{activityStore.error}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => activityStore.clearError()}
			>
				Tutup
			</button>
		</div>
	{/if}

	{#if activityStore.loading && !activityStore.initialized}
		<div class="alert alert-info" role="status">Memuat aktivitas…</div>
	{/if}

	<section aria-label="Statistik ringkas">
		<div class="stat-grid">
			<StatCard
				label="Aktivitas Hari Ini"
				value={String(todayStats.total)}
				hint="{todayStats.pending} belum selesai"
				accent="primary"
			/>
			<StatCard
				label="Aktivitas Selesai"
				value={String(todayStats.completed)}
				hint="dari {todayStats.total} aktivitas"
				accent="success"
			/>
			<StatCard
				label="Progress"
				value="{todayStats.completionRate}%"
				hint="penyelesaian hari ini"
			/>
			<StatCard
				label="Total Waktu"
				value={formatDuration(todayStats.totalDuration)}
				hint="{formatDuration(todayStats.completedDuration)} selesai"
			/>
			<StatCard
				label="Langkah Hari Ini"
				value={todaySteps.toLocaleString('id-ID')}
				hint="{stepsProgress}% dari target {stepStore.goal.toLocaleString('id-ID')}"
				accent="primary"
			/>
		</div>
		<div class="progress-card">
			<ProgressBar value={todayStats.completionRate} label="Progress hari ini" />
		</div>
	</section>

	<StepCounterCard />

	<section class="card" aria-labelledby="today-title">
		<div class="spread">
			<div>
				<h2 id="today-title" class="card-title">Aktivitas Hari Ini</h2>
				<p class="card-subtitle">
					{todayStats.completed}/{todayStats.total} aktivitas selesai
				</p>
			</div>
			{#if todaysActivities.length > 0}
				<button type="button" class="btn btn-secondary btn-sm" onclick={scrollToForm}>
					+ Tambah
				</button>
			{/if}
		</div>

		<div class="list-wrapper">
			<ActivityList
				activities={todaysActivities}
				busy={activityStore.saving}
				emptyTitle="Belum ada aktivitas hari ini."
				emptyMessage="Mulai catat aktivitas pertama Anda untuk hari ini."
				emptyActionLabel="Tambah aktivitas pertama"
				onEmptyAction={scrollToForm}
				onToggle={handleToggle}
				onEdit={openEdit}
				onDelete={requestDelete}
				onSubtasksChange={handleSubtasksChange}
			/>
		</div>
	</section>

	<section class="card" aria-labelledby="weekly-title">
		<h2 id="weekly-title" class="sr-only">Statistik mingguan</h2>
		<WeeklyChart days={weeklyStats} />
	</section>

	<div bind:this={formSection} class="form-anchor">
		<ActivityForm saving={activityStore.saving} onSubmit={handleAdd} />
	</div>

	{#if allStats.total > 0}
		<section class="card" aria-labelledby="all-title">
			<h2 id="all-title" class="card-title">Ringkasan Keseluruhan</h2>
			<p class="card-subtitle">
				{allStats.total} aktivitas tercatat • rata-rata {formatDuration(allStats.averageDuration)}
				per aktivitas
			</p>
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
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.progress-card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-4) var(--space-5);
		margin-top: var(--space-4);
	}

	.list-wrapper {
		margin-top: var(--space-2);
	}

	.form-anchor {
		scroll-margin-top: 4.5rem;
	}

	@media (max-width: 900px) {
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.stat-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
