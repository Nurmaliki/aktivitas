<script lang="ts">
	import { onMount } from 'svelte';
	import type { Activity, ActivityInput } from '$lib/types/activity';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import {
		addDays,
		formatDisplayDate,
		getLocalDateString,
		getWeekdayShort
	} from '$lib/utils/date';
	import {
		activityRange,
		findConflicts,
		minutesToTime,
		sortForTimeline,
		scheduled,
		timeToMinutes,
		unscheduled
	} from '$lib/utils/planner';
	import { subtaskProgress } from '$lib/utils/subtasks';
	import ActivityEditModal from '$lib/components/ActivityEditModal.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	let today = $state('');
	onMount(() => {
		today = getLocalDateString();
	});

	let selectedDate = $state('');
	$effect(() => {
		if (today && !selectedDate) selectedDate = today;
	});

	const dateActivities = $derived(selectedDate ? activityStore.byDate(selectedDate) : []);
	const timeline = $derived(sortForTimeline(scheduled(dateActivities)));
	const unscheduledList = $derived(sortForTimeline(unscheduled(dateActivities)));

	const isToday = $derived(selectedDate === today);

	// Upcoming = future days with scheduled activities (next 7 days), sorted.
	const upcoming = $derived.by(() => {
		if (!today) return [];
		const result: { date: string; activities: Activity[] }[] = [];
		for (let i = 1; i <= 7; i++) {
			const date = addDays(today, i);
			const list = sortForTimeline(scheduled(activityStore.byDate(date)));
			if (list.length > 0) result.push({ date, activities: list });
		}
		return result;
	});

	// Add-activity inline form state.
	let showQuickAdd = $state(false);
	let qName = $state('');
	let qStart = $state('');
	let qDuration = $state(30);
	let qError = $state('');

	// Conflict warning state (non-blocking).
	let conflictMessage = $state('');
	let pendingInput = $state<ActivityInput | null>(null);

	let editing = $state<Activity | null>(null);
	let editOpen = $state(false);
	let deleting = $state<Activity | null>(null);
	let deleteBusy = $state(false);

	async function submitQuickAdd(event: SubmitEvent) {
		event.preventDefault();
		qError = '';
		const name = qName.trim();
		if (!name) {
			qError = 'Nama aktivitas wajib diisi.';
			return;
		}
		const duration = Number(qDuration);
		if (!Number.isFinite(duration) || duration <= 0) {
			qError = 'Durasi harus lebih dari 0 menit.';
			return;
		}

		const start = timeToMinutes(qStart);
		const input: ActivityInput = {
			name,
			category: 'Other',
			date: selectedDate,
			duration,
			plannedDuration: duration,
			completed: false,
			startTime: start !== null ? minutesToTime(start) : undefined,
			endTime: start !== null ? minutesToTime(start + duration) : undefined
		};

		// Detect conflicts against the selected day (excluding none — new record).
		if (start !== null) {
			const conflicts = findConflicts(dateActivities, { start, end: start + duration });
			if (conflicts.length > 0) {
				const c = conflicts[0];
				conflictMessage = `Jadwal bertabrakan dengan "${c.activity.name}" ${minutesToTime(c.range.start)}–${minutesToTime(c.range.end)}.`;
				pendingInput = input;
				return;
			}
		}

		await persistQuickAdd(input);
	}

	async function persistQuickAdd(input: ActivityInput) {
		const created = await activityStore.add(input);
		if (created) {
			qName = '';
			qStart = '';
			qDuration = 30;
			conflictMessage = '';
			pendingInput = null;
			showQuickAdd = false;
		}
	}

	async function saveDespiteConflict() {
		if (pendingInput) await persistQuickAdd(pendingInput);
	}

	function cancelConflict() {
		conflictMessage = '';
		pendingInput = null;
	}

	function shiftDay(days: number) {
		selectedDate = addDays(selectedDate || today, days);
	}

	function goToday() {
		selectedDate = today;
	}

	function openEdit(activity: Activity) {
		editing = activity;
		editOpen = true;
	}

	async function handleSave(id: string, changes: ActivityInput): Promise<boolean> {
		const updated = await activityStore.update(id, changes);
		return updated !== null;
	}

	function handleToggle(id: string) {
		void activityStore.toggle(id);
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

	/** Move an activity to another date, preserving its time slot. */
	async function reschedule(activity: Activity, date: string) {
		await activityStore.update(activity.id, {
			name: activity.name,
			category: activity.category,
			date,
			duration: activity.duration,
			completed: activity.completed,
			startTime: activity.startTime,
			endTime: activity.endTime,
			subtasks: activity.subtasks
		});
	}

	function timelineRange(activity: Activity): string {
		const range = activityRange(activity);
		if (!range) return '—';
		return `${minutesToTime(range.start)}–${minutesToTime(range.end)}`;
	}
</script>

<svelte:head>
	<title>Planner — Daily Activity</title>
	<meta name="description" content="Rencana harian: agenda terjadwal, aktivitas belum dijadwalkan, dan agenda mendatang." />
</svelte:head>

<div class="container page">
	<header class="page-header">
		<h1>Planner Harian</h1>
		<p class="subtitle">Susun agenda harian Anda dan atur waktu tiap aktivitas.</p>
	</header>

	{#if activityStore.error}
		<div class="alert alert-error" role="alert">
			{activityStore.error}
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => activityStore.clearError()}>
				Tutup
			</button>
		</div>
	{/if}

	<!-- Day navigation -->
	<div class="day-nav card">
		<button type="button" class="btn btn-secondary btn-sm" onclick={() => shiftDay(-1)} aria-label="Hari sebelumnya">
			‹ Sebelumnya
		</button>
		<div class="day-nav-center">
			<span class="day-nav-date">{selectedDate ? formatDisplayDate(selectedDate) : '—'}</span>
			{#if isToday}
				<span class="badge badge-today">Hari ini</span>
			{:else}
				<button type="button" class="btn btn-ghost btn-sm" onclick={goToday}>Kembali ke hari ini</button>
			{/if}
		</div>
		<button type="button" class="btn btn-secondary btn-sm" onclick={() => shiftDay(1)} aria-label="Hari berikutnya">
			Berikutnya ›
		</button>
	</div>

	<div class="planner-actions">
		<button type="button" class="btn btn-primary btn-sm" onclick={() => (showQuickAdd = !showQuickAdd)}>
			{showQuickAdd ? 'Tutup' : '+ Tambah ke jadwal'}
		</button>
		<input
			type="date"
			class="date-jump"
			value={selectedDate}
			onchange={(event) => (selectedDate = (event.currentTarget as HTMLInputElement).value)}
			aria-label="Pilih tanggal"
		/>
	</div>

	{#if showQuickAdd}
		<section class="card quick-add" aria-labelledby="quick-add-title">
			<h2 id="quick-add-title" class="card-title">Tambah Aktivitas Terjadwal</h2>
			<form class="quick-add-form" onsubmit={submitQuickAdd} novalidate>
				<div class="field span-2">
					<label for="q-name">Nama</label>
					<input id="q-name" type="text" bind:value={qName} maxlength="120" placeholder="Contoh: Meeting tim" />
				</div>
				<div class="field">
					<label for="q-start">Mulai <span class="muted">(opsional)</span></label>
					<input id="q-start" type="time" bind:value={qStart} />
				</div>
				<div class="field">
					<label for="q-duration">Durasi (menit)</label>
					<input id="q-duration" type="number" min="1" max="1440" step="5" bind:value={qDuration} />
				</div>
				{#if qError}
					<p class="field-error span-2" role="alert">{qError}</p>
				{/if}
				<div class="span-2 form-actions">
					<button type="submit" class="btn btn-primary" disabled={activityStore.saving}>
						{activityStore.saving ? 'Menyimpan…' : 'Tambah'}
					</button>
				</div>
			</form>
		</section>
	{/if}

	{#if conflictMessage}
		<div class="alert alert-warning" role="alert">
			<p>{conflictMessage}</p>
			<div class="conflict-actions">
				<button type="button" class="btn btn-secondary btn-sm" onclick={cancelConflict}>Ubah waktu</button>
				<button type="button" class="btn btn-primary btn-sm" onclick={saveDespiteConflict}>
					Tetap simpan
				</button>
			</div>
		</div>
	{/if}

	<!-- Timeline -->
	<section class="card" aria-labelledby="timeline-title">
		<div class="spread">
			<div>
				<h2 id="timeline-title" class="card-title">Agenda Terjadwal</h2>
				<p class="card-subtitle">{timeline.length} aktivitas dengan waktu</p>
			</div>
		</div>

		{#if timeline.length === 0}
			<p class="empty-inline">Belum ada aktivitas terjadwal untuk hari ini.</p>
		{:else}
			<ol class="timeline" aria-label="Timeline agenda">
				{#each timeline as activity (activity.id)}
					<li class="timeline-row" class:completed={activity.completed}>
						<div class="timeline-time">
							<strong>{minutesToTime(timeToMinutes(activity.startTime) ?? 0)}</strong>
							<span class="timeline-range">{timelineRange(activity)}</span>
						</div>
						<div class="timeline-body">
							<div class="timeline-head">
								<label class="timeline-check">
									<input
										type="checkbox"
										checked={activity.completed}
										disabled={activityStore.saving}
										onchange={() => handleToggle(activity.id)}
										aria-label="Tandai {activity.name}"
									/>
								</label>
								<span class="timeline-name">{activity.name}</span>
								<span class="badge category-badge">{activity.category}</span>
								{#if subtaskProgress(activity.subtasks).total > 0}
									<span class="timeline-subcount">
										{subtaskProgress(activity.subtasks).completed}/{subtaskProgress(activity.subtasks).total}
									</span>
								{/if}
							</div>
							{#if activity.description}
								<p class="timeline-desc">{activity.description}</p>
							{/if}
							<div class="timeline-actions">
								<button type="button" class="btn btn-ghost btn-sm" onclick={() => openEdit(activity)}>Edit</button>
								<button type="button" class="btn btn-ghost btn-sm" onclick={() => reschedule(activity, addDays(activity.date, 1))}>
									Besok
								</button>
								<button type="button" class="btn btn-ghost btn-sm danger-text" onclick={() => requestDelete(activity)}>Hapus</button>
							</div>
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	</section>

	<!-- Unscheduled -->
	{#if unscheduledList.length > 0}
		<section class="card" aria-labelledby="unscheduled-title">
			<h2 id="unscheduled-title" class="card-title">Belum Dijadwalkan</h2>
			<p class="card-subtitle">Aktivitas tanpa waktu. Tambahkan waktu melalui Edit.</p>
			<ul class="unscheduled-list">
				{#each unscheduledList as activity (activity.id)}
					<li class="unscheduled-row">
						<label class="timeline-check">
							<input
								type="checkbox"
								checked={activity.completed}
								disabled={activityStore.saving}
								onchange={() => handleToggle(activity.id)}
								aria-label="Tandai {activity.name}"
							/>
						</label>
						<span class="unscheduled-name" class:done={activity.completed}>{activity.name}</span>
						<span class="badge category-badge">{activity.category}</span>
						<button type="button" class="btn btn-ghost btn-sm" onclick={() => openEdit(activity)}>Jadwalkan</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Upcoming -->
	<section class="card" aria-labelledby="upcoming-title">
		<h2 id="upcoming-title" class="card-title">Agenda Mendatang</h2>
		{#if upcoming.length === 0}
			<p class="empty-inline">Belum ada agenda dalam 7 hari ke depan.</p>
		{:else}
			<ul class="upcoming-list">
				{#each upcoming as day (day.date)}
					<li class="upcoming-day">
						<button type="button" class="upcoming-date" onclick={() => (selectedDate = day.date)}>
							<span class="upcoming-weekday">{getWeekdayShort(day.date)}</span>
							<span>{formatDisplayDate(day.date)}</span>
						</button>
						<ul class="upcoming-items">
							{#each day.activities as activity (activity.id)}
								<li>
									<span class="upcoming-time">{minutesToTime(timeToMinutes(activity.startTime) ?? 0)}</span>
									<span>{activity.name}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<ActivityEditModal
	activity={editing}
	open={editOpen}
	saving={activityStore.saving}
	onSave={handleSave}
	onClose={() => {
		editOpen = false;
		editing = null;
	}}
/>

<ConfirmDialog
	open={deleting !== null}
	title="Hapus aktivitas?"
	message={deleting ? `Aktivitas "${deleting.name}" akan dihapus permanen.` : ''}
	confirmLabel="Ya, hapus"
	danger
	busy={deleteBusy}
	onConfirm={confirmDelete}
	onCancel={() => (deleting = null)}
/>

<style>
	.day-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
	}

	.day-nav-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
		text-align: center;
	}

	.day-nav-date {
		font-weight: 700;
	}

	.badge-today {
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
		font-size: 0.72rem;
		padding: 2px 8px;
		border-radius: var(--radius-full);
	}

	.planner-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		margin-bottom: var(--space-4);
	}

	.date-jump {
		padding: 0.35rem 0.6rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background-color: var(--color-surface);
		color: var(--color-text);
	}

	.quick-add-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.conflict-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}

	.empty-inline {
		color: var(--color-text-muted);
		font-size: 0.9rem;
	}

	.timeline {
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
	}

	.timeline-row {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.timeline-row:last-child {
		border-bottom: none;
	}

	.timeline-time {
		flex-shrink: 0;
		width: 5.5rem;
		display: flex;
		flex-direction: column;
		font-variant-numeric: tabular-nums;
	}

	.timeline-range {
		font-size: 0.72rem;
		color: var(--color-text-subtle);
	}

	.timeline-body {
		flex: 1;
		min-width: 0;
	}

	.timeline-head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.timeline-name {
		font-weight: 600;
	}

	.completed .timeline-name {
		text-decoration: line-through;
		color: var(--color-text-muted);
	}

	.timeline-subcount {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.timeline-desc {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		margin-top: 2px;
	}

	.timeline-actions {
		display: flex;
		gap: var(--space-1);
		margin-top: var(--space-1);
		flex-wrap: wrap;
	}

	.category-badge {
		background-color: var(--color-surface-alt);
		color: var(--color-text-muted);
		font-size: 0.72rem;
		padding: 2px 8px;
		border-radius: var(--radius-full);
	}

	.unscheduled-list,
	.upcoming-list {
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
	}

	.unscheduled-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.unscheduled-row:last-child {
		border-bottom: none;
	}

	.unscheduled-name {
		flex: 1;
		min-width: 0;
	}

	.unscheduled-name.done {
		text-decoration: line-through;
		color: var(--color-text-muted);
	}

	.upcoming-day {
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.upcoming-day:last-child {
		border-bottom: none;
	}

	.upcoming-date {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--color-primary);
		cursor: pointer;
	}

	.upcoming-date:hover {
		text-decoration: underline;
	}

	.upcoming-weekday {
		background-color: var(--color-surface-alt);
		color: var(--color-text-muted);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
	}

	.upcoming-items {
		list-style: none;
		margin: var(--space-1) 0 0;
		padding: 0 0 0 var(--space-4);
		font-size: 0.88rem;
	}

	.upcoming-items li {
		display: flex;
		gap: var(--space-2);
		padding: 2px 0;
	}

	.upcoming-time {
		font-variant-numeric: tabular-nums;
		color: var(--color-text-subtle);
		min-width: 3rem;
	}

	@media (max-width: 640px) {
		.day-nav {
			flex-wrap: wrap;
			justify-content: center;
		}

		.quick-add-form {
			grid-template-columns: 1fr;
		}

		.timeline-row {
			flex-direction: column;
			gap: var(--space-1);
		}

		.timeline-time {
			flex-direction: row;
			align-items: baseline;
			gap: var(--space-2);
			width: auto;
		}
	}
</style>
