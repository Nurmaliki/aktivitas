<script lang="ts">
	import { onMount } from 'svelte';
	import type { Habit, HabitInput } from '$lib/types/habit';
	import { habitStore } from '$lib/stores/habit.svelte.js';
	import { getLocalDateString, formatHeaderDate, addDays } from '$lib/utils/date';
	import { isScheduledOn } from '$lib/utils/habits';
	import HabitForm from '$lib/components/HabitForm.svelte';
	import HabitHeatmap from '$lib/components/HabitHeatmap.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import EmptyIcon from '$lib/components/EmptyIcon.svelte';
	import InlineIcon from '$lib/components/InlineIcon.svelte';

	let today = $state('');
	onMount(() => {
		today = getLocalDateString();
		habitStore.init();
	});

	let editing = $state<Habit | null>(null);
	let archiving = $state<Habit | null>(null);
	let archiveBusy = $state(false);
	let expandedId = $state<string | null>(null);

	const activeHabits = $derived(habitStore.habits.filter((h) => h.active && !h.deletedAt));
	const todayScheduled = $derived(
		today ? activeHabits.filter((h) => isScheduledOn(h, today)) : []
	);
	const completedToday = $derived(
		today ? todayScheduled.filter((h) => habitStore.isCompletedOn(h.id, today)).length : 0
	);

	// Last 7 days per habit for the mini week strip.
	function last7(): string[] {
		if (!today) return [];
		return Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));
	}
	const week = $derived(last7());

	const logIndex = $derived(habitStore.completionIndex());

	async function handleSubmit(input: HabitInput): Promise<boolean> {
		if (editing) {
			const updated = await habitStore.update(editing.id, input);
			if (updated) {
				editing = null;
				return true;
			}
			return false;
		}
		const created = await habitStore.add(input);
		return created !== null;
	}

	function startEdit(habit: Habit) {
		editing = habit;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function cancelEdit() {
		editing = null;
	}

	async function confirmArchive() {
		if (!archiving) return;
		const id = archiving.id;
		archiveBusy = true;
		await habitStore.archive(id);
		archiveBusy = false;
		archiving = null;
		if (editing?.id === id) editing = null;
	}

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<svelte:head>
	<title>Kebiasaan — Daily Activity</title>
	<meta name="description" content="Habit tracker dengan streak dan heatmap konsistensi." />
</svelte:head>

<div class="container page">
	<header class="page-header">
		<h1>Kebiasaan</h1>
		<p class="subtitle">Bangun kebiasaan baik dengan pelacakan streak harian.</p>
		{#if today}<p class="today">Hari ini: {formatHeaderDate(today)}</p>{/if}
	</header>

	{#if habitStore.error}
		<div class="alert alert-error" role="alert">
			{habitStore.error}
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => habitStore.clearError()}>Tutup</button>
		</div>
	{/if}

	<section class="card" aria-labelledby="today-habits-title">
		<div class="spread">
			<div>
				<h2 id="today-habits-title" class="card-title">Kebiasaan Hari Ini</h2>
				<p class="card-subtitle">{completedToday}/{todayScheduled.length} selesai</p>
			</div>
			{#if todayScheduled.length > 0}
				<span class="today-progress">{todayScheduled.length === 0 ? 0 : Math.round((completedToday / todayScheduled.length) * 100)}%</span>
			{/if}
		</div>

		{#if todayScheduled.length === 0}
			<div class="empty-state">
				<EmptyIcon name="habit" />
				<p class="empty-title">Belum ada kebiasaan untuk hari ini.</p>
				<p class="empty-message">Tambahkan kebiasaan di bawah untuk mulai melacak.</p>
			</div>
		{:else}
			<ul class="habit-today-list" aria-label="Daftar kebiasaan hari ini">
				{#each todayScheduled as habit (habit.id)}
					{@const done = habitStore.isCompletedOn(habit.id, today)}
					{@const streak = habitStore.streakFor(habit)}
					<li class="habit-row" class:done>
						<label class="habit-check">
							<input
								type="checkbox"
								checked={done}
								disabled={habitStore.saving}
								onchange={() => habitStore.toggleCompletion(habit.id, today)}
								aria-label="Tandai {habit.name} {done ? 'belum selesai' : 'selesai'}"
							/>
						</label>
						<div class="habit-main">
							<div class="habit-head">
								<span class="habit-name">{habit.name}</span>
								{#if habit.categoryId}<span class="badge category-badge">{habit.categoryId}</span>{/if}
							</div>
							<div class="habit-meta">
								<span class="streak"><InlineIcon name="flame" /> {streak.current} hari</span>
								<span class="muted">Terpanjang: {streak.longest}</span>
								<span class="muted">{streak.completionRate}% (30 hari)</span>
							</div>
							{#if expandedId === habit.id}
								<div class="habit-heat">
									<HabitHeatmap {habit} {logIndex} {today} />
								</div>
							{/if}
						</div>
						<div class="habit-actions">
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								aria-expanded={expandedId === habit.id}
								onclick={() => toggleExpand(habit.id)}
							>
								{expandedId === habit.id ? 'Tutup' : 'Heatmap'}
							</button>
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => startEdit(habit)}>Edit</button>
							<button type="button" class="btn btn-ghost btn-sm danger-text" onclick={() => (archiving = habit)}>Arsip</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<HabitForm saving={habitStore.saving} onSubmit={handleSubmit} {editing} onCancelEdit={cancelEdit} />

	{#if activeHabits.length > 0}
		<section class="card" aria-labelledby="week-overview-title">
			<h2 id="week-overview-title" class="card-title">Ringkasan 7 Hari</h2>
			<div class="table-scroll">
				<table class="week-table">
					<thead>
						<tr>
							<th scope="col">Kebiasaan</th>
							{#each week as date (date)}
								<th scope="col" class="day-head">
									{new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' })}
								</th>
							{/each}
							<th scope="col">Streak</th>
						</tr>
					</thead>
					<tbody>
						{#each activeHabits as habit (habit.id)}
							<tr>
								<th scope="row">{habit.name}</th>
								{#each week as date (date)}
									<td class="day-cell">
										{#if isScheduledOn(habit, date)}
											<span
												class="day-dot"
												class:filled={habitStore.isCompletedOn(habit.id, date)}
												title="{date}: {habitStore.isCompletedOn(habit.id, date) ? 'Selesai' : 'Belum'}"
												aria-label="{date}: {habitStore.isCompletedOn(habit.id, date) ? 'Selesai' : 'Belum'}"
											></span>
										{:else}
											<span class="day-dot off" title="{date}: tidak dijadwalkan" aria-label="{date}: tidak dijadwalkan"></span>
										{/if}
									</td>
								{/each}
								<td><InlineIcon name="flame" /> {habitStore.streakFor(habit).current}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

<ConfirmDialog
	open={archiving !== null}
	title="Arsipkan kebiasaan?"
	message={archiving ? `Kebiasaan "${archiving.name}" akan diarsipkan beserta log-nya.` : ''}
	confirmLabel="Ya, arsipkan"
	danger
	busy={archiveBusy}
	onConfirm={confirmArchive}
	onCancel={() => (archiving = null)}
/>

<style>
	.spread {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.today-progress {
		font-size: 1.35rem;
		font-weight: 800;
		color: var(--color-primary);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-4);
		text-align: center;
	}

	.empty-title {
		font-weight: 700;
	}

	.empty-message {
		color: var(--color-text-muted);
		font-size: 0.9rem;
	}

	.habit-today-list {
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
	}

	.habit-row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-1);
		border-bottom: 1px solid var(--color-border);
	}

	.habit-row:last-child {
		border-bottom: none;
	}

	.habit-check input {
		width: 1.2rem;
		height: 1.2rem;
		margin-top: 2px;
		accent-color: var(--color-success);
		cursor: pointer;
	}

	.habit-main {
		flex: 1;
		min-width: 0;
	}

	.habit-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.habit-name {
		font-weight: 600;
	}

	.habit-row.done .habit-name {
		text-decoration: line-through;
		color: var(--color-text-muted);
	}

	.habit-meta {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: var(--color-text-subtle);
		margin-top: 2px;
	}

	.streak {
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.habit-heat {
		margin-top: var(--space-2);
	}

	.habit-actions {
		display: flex;
		gap: var(--space-1);
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.category-badge {
		background-color: var(--color-surface-alt);
		color: var(--color-text-muted);
		font-size: 0.7rem;
		padding: 2px 8px;
		border-radius: var(--radius-full);
	}

	.week-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.week-table th,
	.week-table td {
		padding: var(--space-2);
		text-align: center;
		border-bottom: 1px solid var(--color-border);
	}

	.week-table th[scope='row'] {
		text-align: left;
		white-space: nowrap;
	}

	.day-dot {
		display: inline-block;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		background-color: transparent;
	}

	.day-dot.filled {
		background-color: var(--color-success);
		border-color: var(--color-success);
	}

	.day-dot.off {
		opacity: 0.3;
		border-style: dashed;
	}

	.danger-text {
		color: var(--color-danger);
	}

	@media (max-width: 640px) {
		.habit-row {
			flex-wrap: wrap;
		}

		.habit-actions {
			width: 100%;
			justify-content: flex-end;
		}
	}
</style>
