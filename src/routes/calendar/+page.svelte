<script lang="ts">
	import { onMount } from 'svelte';
	import type { Activity, ActivityInput } from '$lib/types/activity';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import {
		addDays,
		formatDisplayDate,
		formatMonthLabel,
		getLocalDateString,
		getMonthStart,
		parseLocalDate
	} from '$lib/utils/date';
	import {
		hourLabel,
		hourSlots,
		monthGrid,
		weekDates,
		weekdayLabels,
		type CalendarCell,
		type WeekStart
	} from '$lib/utils/calendar';
	import { activityRange, minutesToTime, sortForTimeline, timeToMinutes } from '$lib/utils/planner';
	import ActivityEditModal from '$lib/components/ActivityEditModal.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	type View = 'day' | 'week' | 'month';

	let today = $state('');
	onMount(() => {
		today = getLocalDateString();
	});

	const weekStartsOn: WeekStart = 1;

	let view = $state<View>('month');
	let selectedDate = $state('');
	$effect(() => {
		if (today && !selectedDate) selectedDate = today;
	});

	// Anchor for month/week navigation.
	const anchor = $derived(selectedDate || today);

	const grid = $derived(anchor ? monthGrid(anchor, weekStartsOn) : []);
	const week = $derived(anchor ? weekDates(anchor, weekStartsOn) : []);
	const labels = $derived(weekdayLabels(weekStartsOn));
	const hours = $derived(hourSlots(6, 23));

	/** Activities grouped by date for fast lookups. */
	const byDate = $derived.by(() => {
		const map = new Map<string, Activity[]>();
		for (const activity of activityStore.activities) {
			const list = map.get(activity.date) ?? [];
			list.push(activity);
			map.set(activity.date, list);
		}
		return map;
	});

	function dayActivities(date: string): Activity[] {
		return byDate.get(date) ?? [];
	}

	// Current-time indicator (minutes since midnight), only meaningful for the
	// current hour; refreshed every minute while the page is open.
	let nowMinutes = $state(-1);
	$effect(() => {
		if (!today) return;
		const update = () => {
			const now = new Date();
			nowMinutes = now.getHours() * 60 + now.getMinutes();
		};
		update();
		const timer = setInterval(update, 60_000);
		return () => clearInterval(timer);
	});

	const showNowLine = $derived(view === 'day' && selectedDate === today && nowMinutes >= 0);

	let editing = $state<Activity | null>(null);
	let editOpen = $state(false);
	let deleting = $state<Activity | null>(null);
	let deleteBusy = $state(false);

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

	async function confirmDelete() {
		if (!deleting) return;
		deleteBusy = true;
		await activityStore.remove(deleting.id);
		deleteBusy = false;
		deleting = null;
	}

	function pick(date: string) {
		selectedDate = date;
		if (view === 'month') view = 'day';
	}

	function shift(dir: number) {
		if (view === 'day') selectedDate = addDays(selectedDate, dir);
		else if (view === 'week') selectedDate = addDays(selectedDate, dir * 7);
		else {
			const parsed = parseLocalDate(getMonthStart(selectedDate)) ?? new Date();
			selectedDate = getLocalDateString(new Date(parsed.getFullYear(), parsed.getMonth() + dir, 1));
		}
	}

	function goToday() {
		selectedDate = today;
	}

	const headerLabel = $derived.by(() => {
		if (!anchor) return '';
		if (view === 'month') return formatMonthLabel(anchor);
		if (view === 'week') {
			const days = weekDates(anchor, weekStartsOn);
			return `${formatDisplayDate(days[0])} – ${formatDisplayDate(days[6])}`;
		}
		return formatDisplayDate(anchor);
	});

	function cellDots(cell: CalendarCell): { done: number; total: number } {
		const list = dayActivities(cell.date);
		return { done: list.filter((a) => a.completed).length, total: list.length };
	}

	function positioned(activity: Activity): { top: number; height: number } {
		const range = activityRange(activity);
		const start = range ? range.start : 0;
		const end = range ? range.end : start + activity.duration;
		const top = ((start - 360) / 60) * 48; // 48px per hour, from 06:00
		const height = Math.max(24, ((end - start) / 60) * 48);
		return { top, height };
	}
</script>

<svelte:head>
	<title>Kalender — Daily Activity</title>
	<meta name="description" content="Kalender aktivitas harian: tampilan hari, minggu, dan bulan." />
</svelte:head>

<div class="container page">
	<header class="page-header">
		<h1>Kalender</h1>
		<p class="subtitle">Lihat aktivitas dalam tampilan hari, minggu, atau bulan.</p>
	</header>

	<div class="cal-toolbar card">
		<div class="cal-toolbar-nav">
			<button type="button" class="btn btn-secondary btn-sm" onclick={() => shift(-1)} aria-label="Sebelumnya">‹</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={goToday}>Hari ini</button>
			<button type="button" class="btn btn-secondary btn-sm" onclick={() => shift(1)} aria-label="Berikutnya">›</button>
		</div>
		<span class="cal-label">{headerLabel}</span>
		<div class="view-switch" role="tablist" aria-label="Mode tampilan kalender">
			{#each ['day', 'week', 'month'] as const as mode (mode)}
				<button
					type="button"
					role="tab"
					aria-selected={view === mode}
					class="view-btn"
					class:active={view === mode}
					onclick={() => (view = mode)}
				>
					{mode === 'day' ? 'Hari' : mode === 'week' ? 'Minggu' : 'Bulan'}
				</button>
			{/each}
		</div>
	</div>

	{#if activityStore.loading && !activityStore.initialized}
		<div class="alert alert-info" role="status">Memuat aktivitas…</div>
	{/if}

	<!-- MONTH VIEW -->
	{#if view === 'month'}
		<section class="card" aria-label="Tampilan bulan">
			<div class="month-grid" role="grid">
				{#each labels as label (label.index)}
					<div class="month-weekday" role="columnheader" aria-label={label.label}>{label.label}</div>
				{/each}
				{#each grid as cell (cell.date)}
					<button
						type="button"
						role="gridcell"
						class="month-cell"
						class:out={!cell.inMonth}
						class:today={cell.isToday}
						class:selected={cell.date === selectedDate}
						onclick={() => pick(cell.date)}
						aria-label="{formatDisplayDate(cell.date)}, {cellDots(cell).total} aktivitas"
					>
						<span class="month-day">{cell.day}</span>
						{#if cellDots(cell).total > 0}
							<span class="month-dots" aria-hidden="true">
								{#each Array(Math.min(cellDots(cell).done, 4)) as _}<span class="dot done"></span>{/each}
								{#each Array(Math.min(cellDots(cell).total - cellDots(cell).done, 4)) as _}<span class="dot"></span>{/each}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<!-- WEEK VIEW -->
	{#if view === 'week'}
		<section class="card" aria-label="Tampilan minggu">
			<div class="week-scroll">
				<div class="week-grid">
					<div class="week-corner" aria-hidden="true"></div>
					{#each week as date (date)}
						<button
							type="button"
							class="week-head"
							class:today={date === today}
							class:selected={date === selectedDate}
							onclick={() => pick(date)}
						>
							<span class="week-wd">{new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short' })}</span>
							<span class="week-num">{Number(date.slice(8))}</span>
						</button>
					{/each}
					{#each hours as hour (hour)}
						<div class="week-hour">{hourLabel(hour)}</div>
						{#each week as date (date + hour)}
							<div class="week-slot">
								{#each dayActivities(date).filter((a) => {
									const r = activityRange(a);
									const start = r ? r.start : -1;
									return start >= hour * 60 && start < (hour + 1) * 60;
								}) as activity (activity.id)}
									<button type="button" class="week-event" class:completed={activity.completed} onclick={() => openEdit(activity)}>
										{activity.name}
									</button>
								{/each}
							</div>
						{/each}
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<!-- DAY VIEW -->
	{#if view === 'day'}
		<section class="card" aria-label="Tampilan hari">
			<h2 class="card-title">{formatDisplayDate(selectedDate)}</h2>
			<div class="day-scroll">
				<div class="day-grid">
					{#each hours as hour (hour)}
						<div class="day-hour">{hourLabel(hour)}</div>
						<div class="day-slot"></div>
					{/each}
					{#if showNowLine}
						<div class="now-line" style="top: {((nowMinutes - 360) / 60) * 48}px" aria-hidden="true">
							<span class="now-dot"></span>
						</div>
					{/if}
					{#each sortForTimeline(dayActivities(selectedDate)) as activity (activity.id)}
						{@const pos = positioned(activity)}
						<button
							type="button"
							class="day-event"
							class:completed={activity.completed}
							style="top: {pos.top}px; height: {pos.height}px"
							onclick={() => openEdit(activity)}
							aria-label="{minutesToTime(timeToMinutes(activity.startTime) ?? 0)} {activity.name}"
						>
							<strong>
								{activity.startTime ? `${activity.startTime}` : '—'}
							</strong>
							<span class="day-event-name">{activity.name}</span>
						</button>
					{/each}
				</div>
			</div>
			{#if dayActivities(selectedDate).length === 0}
				<p class="empty-inline">Tidak ada aktivitas pada tanggal ini.</p>
			{/if}
		</section>
	{/if}
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
	.cal-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding: var(--space-3) var(--space-4);
	}

	.cal-toolbar-nav {
		display: flex;
		gap: var(--space-1);
	}

	.cal-label {
		font-weight: 700;
		flex: 1;
		text-align: center;
		min-width: 8rem;
	}

	.view-switch {
		display: flex;
		background-color: var(--color-surface-alt);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.view-btn {
		border: none;
		background: none;
		padding: 0.35rem 0.7rem;
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.view-btn.active {
		background-color: var(--color-surface);
		color: var(--color-primary);
		box-shadow: var(--shadow-sm);
	}

	/* ---- Month ---- */
	.month-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 4px;
	}

	.month-weekday {
		text-align: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--color-text-muted);
		padding: 4px 0;
	}

	.month-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 3px;
		min-height: 3rem;
		padding: 4px 2px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background-color: var(--color-surface);
		cursor: pointer;
		font: inherit;
	}

	.month-cell.out {
		opacity: 0.45;
	}

	.month-cell.today {
		border-color: var(--color-primary);
	}

	.month-cell.selected {
		background-color: var(--color-primary-soft);
	}

	.month-day {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.month-dots {
		display: flex;
		gap: 2px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background-color: var(--color-border);
	}

	.dot.done {
		background-color: var(--color-success);
	}

	/* ---- Week / Day shared scroll ---- */
	.week-scroll,
	.day-scroll {
		overflow: auto;
		max-height: 70vh;
	}

	.week-grid {
		display: grid;
		grid-template-columns: 3.5rem repeat(7, minmax(4.5rem, 1fr));
		position: relative;
		min-width: 32rem;
	}

	.week-corner {
		position: sticky;
		top: 0;
		background-color: var(--color-surface);
		z-index: 2;
	}

	.week-head {
		position: sticky;
		top: 0;
		background-color: var(--color-surface);
		z-index: 2;
		border: none;
		border-bottom: 1px solid var(--color-border);
		padding: var(--space-2) 0;
		font: inherit;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.week-head.today .week-num,
	.week-head.selected .week-num {
		color: var(--color-primary);
		font-weight: 700;
	}

	.week-wd {
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.week-num {
		font-weight: 600;
	}

	.week-hour,
	.day-hour {
		font-size: 0.7rem;
		color: var(--color-text-subtle);
		text-align: right;
		padding-right: 6px;
		height: 48px;
		border-top: 1px solid var(--color-border);
	}

	.week-slot,
	.day-slot {
		height: 48px;
		border-top: 1px solid var(--color-border);
		border-left: 1px solid var(--color-border);
		position: relative;
		padding: 1px;
	}

	.week-event {
		display: block;
		width: 100%;
		text-align: left;
		font-size: 0.72rem;
		padding: 2px 4px;
		border: none;
		border-radius: var(--radius-sm);
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
		cursor: pointer;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.week-event.completed {
		background-color: var(--color-success-soft, #dcfce7);
		color: var(--color-success);
		text-decoration: line-through;
	}

	/* ---- Day ---- */
	.day-grid {
		display: grid;
		grid-template-columns: 3.5rem 1fr;
		position: relative;
		max-width: 40rem;
	}

	.now-line {
		position: absolute;
		left: 3.5rem;
		right: 0;
		height: 2px;
		background-color: var(--color-danger, #c0392b);
		z-index: 3;
	}

	.now-dot {
		position: absolute;
		left: -4px;
		top: -3px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--color-danger, #c0392b);
	}

	.day-event {
		position: absolute;
		left: 3.75rem;
		right: var(--space-2);
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		text-align: left;
		padding: 2px 6px;
		border: none;
		border-left: 3px solid var(--color-primary);
		border-radius: var(--radius-sm);
		background-color: var(--color-primary-soft);
		color: var(--color-text);
		cursor: pointer;
		overflow: hidden;
		font-size: 0.78rem;
		z-index: 4;
	}

	.day-event.completed {
		border-left-color: var(--color-success);
		background-color: var(--color-success-soft, #dcfce7);
		text-decoration: line-through;
	}

	.day-event-name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.empty-inline {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		margin-top: var(--space-3);
	}

	@media (max-width: 560px) {
		.cal-label {
			order: -1;
			width: 100%;
		}
	}
</style>
