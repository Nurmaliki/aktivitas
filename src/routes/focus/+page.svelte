<script lang="ts">
	import { onMount } from 'svelte';
	import type { FocusPhase } from '$lib/types/focus';
	import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES } from '$lib/types/focus';
	import { focusStore } from '$lib/stores/focus.svelte.js';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { getLocalDateString, localDateFromISO } from '$lib/utils/date';
	import { computeTimer, formatClock, phaseLabel, phaseMinutes } from '$lib/utils/focus';
	import InlineIcon from '$lib/components/InlineIcon.svelte';

	let today = $state('');
	onMount(() => {
		today = getLocalDateString();
		focusStore.init();
		focusStore.startClock();
		return () => focusStore.stopClock();
	});

	const timer = $derived(
		focusStore.current ? computeTimer(focusStore.current, focusStore.now || Date.now()) : null
	);
	const phase = $derived<FocusPhase>(focusStore.current?.phase ?? 'focus');
	const remainingLabel = $derived(timer ? formatClock(timer.remainingMs) : formatClock(phaseMinutes(phase, focusStore.settings) * 60_000));
	const progressPercent = $derived(timer ? timer.percent : 0);

	// Auto-advance when a phase completes while on this page.
	let autoAdvanced = $state(false);
	$effect(() => {
		if (timer?.complete && focusStore.current && !autoAdvanced) {
			autoAdvanced = true;
			void focusStore.advancePhase().finally(() => {
				autoAdvanced = false;
			});
		}
	});

	let linkActivityId = $state('');

	const todaysActivities = $derived(today ? activityStore.byDate(today) : []);

	function startFocus(phaseName: FocusPhase) {
		const activity = todaysActivities.find((a) => a.id === linkActivityId);
		void focusStore.start(phaseName, activity?.id, activity?.name);
	}

	function todayFocusMinutes(): number {
		const prefix = today;
		return focusStore.sessions
			.filter(
				(s) =>
					s.phase === 'focus' &&
					s.status === 'completed' &&
					localDateFromISO(s.startedAt) === prefix
			)
			.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0);
	}

	const todayMinutes = $derived(today ? todayFocusMinutes() : 0);
	const completedToday = $derived(
		focusStore.sessions.filter(
			(s) => s.phase === 'focus' && s.status === 'completed' && localDateFromISO(s.startedAt) === today
		).length
	);

	const recentSessions = $derived(focusStore.sessions.slice(0, 12));

	function clampFocus(value: number): number {
		if (!Number.isFinite(value)) return 25;
		return Math.max(MIN_FOCUS_MINUTES, Math.min(MAX_FOCUS_MINUTES, Math.round(value)));
	}
	function clampBreak(value: number): number {
		if (!Number.isFinite(value)) return 5;
		return Math.max(1, Math.min(120, Math.round(value)));
	}
	function statusLabel(status: string): string {
		return (
			{ running: 'Berjalan', paused: 'Dijeda', completed: 'Selesai', cancelled: 'Dibatalkan' }[status] ??
			status
		);
	}
</script>

<svelte:head>
	<title>Fokus — Daily Activity</title>
	<meta name="description" content="Pomodoro & focus mode: timer, break otomatis, dan statistik sesi fokus." />
</svelte:head>

<div class="container page">
	{#if focusStore.current}
		<section class="focus-hero" aria-label="Sesi fokus aktif">
			<p class="focus-phase">{phaseLabel(focusStore.current.phase)}</p>
			{#if focusStore.current.activityName}
				<p class="focus-activity">{focusStore.current.activityName}</p>
			{/if}
			<p class="focus-clock" class:done={timer?.complete}>{remainingLabel}</p>

			<div
				class="focus-bar"
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={progressPercent}
				aria-label="Progres sesi"
			>
				<span class="focus-bar-fill" style="width: {progressPercent}%"></span>
			</div>

			<div class="focus-controls">
				{#if focusStore.current.status === 'running'}
					<button type="button" class="btn btn-secondary" onclick={() => focusStore.pause()} disabled={focusStore.saving}>
						Jeda
					</button>
				{:else}
					<button type="button" class="btn btn-primary" onclick={() => focusStore.resume()} disabled={focusStore.saving}>
						Lanjutkan
					</button>
				{/if}
				<button type="button" class="btn btn-primary" onclick={() => focusStore.finish()} disabled={focusStore.saving}>
					Selesai
				</button>
				<button type="button" class="btn btn-ghost danger-text" onclick={() => focusStore.cancel()} disabled={focusStore.saving}>
					Batalkan
				</button>
			</div>

			<p class="focus-hint">
				Status: {focusStore.current.status === 'running' ? 'Berjalan' : 'Dijeda'} • Refresh halaman tidak
				menghilangkan sesi (berbasis timestamp).
			</p>
		</section>
	{:else}
		<header class="page-header">
			<h1>Fokus</h1>
			<p class="subtitle">Pomodoro & focus mode untuk membantu Anda tetap produktif.</p>
		</header>

		<div class="stat-grid">
			<div class="mini-stat">
				<span class="mini-icon" aria-hidden="true"><InlineIcon name="target" size={22} /></span>
				<div class="mini-body">
					<span class="mini-value">{completedToday}</span>
					<span class="mini-label">Sesi fokus hari ini</span>
				</div>
			</div>
			<div class="mini-stat">
				<span class="mini-icon" aria-hidden="true"><InlineIcon name="check" size={22} /></span>
				<div class="mini-body">
					<span class="mini-value">{todayMinutes} mnt</span>
					<span class="mini-label">Total waktu fokus hari ini</span>
				</div>
			</div>
		</div>

		<section class="card" aria-labelledby="start-title">
			<h2 id="start-title" class="card-title">Mulai Sesi</h2>
			<div class="start-row">
				<label for="focus-activity">Tautkan ke aktivitas <span class="muted">(opsional)</span></label>
				<select id="focus-activity" bind:value={linkActivityId}>
					<option value="">— Tanpa aktivitas —</option>
					{#each todaysActivities as activity (activity.id)}
						<option value={activity.id}>{activity.name}</option>
					{/each}
				</select>
			</div>
			<div class="start-buttons">
				<button type="button" class="btn btn-primary" onclick={() => startFocus('focus')} disabled={focusStore.saving}>
					Mulai Fokus ({focusStore.settings.focusMinutes} mnt)
				</button>
				<button type="button" class="btn btn-secondary" onclick={() => startFocus('shortBreak')} disabled={focusStore.saving}>
					Istirahat Pendek ({focusStore.settings.shortBreakMinutes} mnt)
				</button>
				<button type="button" class="btn btn-secondary" onclick={() => startFocus('longBreak')} disabled={focusStore.saving}>
					Istirahat Panjang ({focusStore.settings.longBreakMinutes} mnt)
				</button>
			</div>
		</section>

		<section class="card" aria-labelledby="config-title">
			<h2 id="config-title" class="card-title">Pengaturan Pomodoro</h2>
			<div class="config-grid">
				<div class="field">
					<label for="cfg-focus">Fokus (menit)</label>
					<input
						id="cfg-focus"
						type="number"
						min={MIN_FOCUS_MINUTES}
						max={MAX_FOCUS_MINUTES}
						value={focusStore.settings.focusMinutes}
						oninput={(e) => focusStore.updateSettings({ focusMinutes: clampFocus(Number(e.currentTarget.value)) })}
					/>
				</div>
				<div class="field">
					<label for="cfg-short">Istirahat pendek</label>
					<input
						id="cfg-short"
						type="number"
						min="1"
						max="60"
						value={focusStore.settings.shortBreakMinutes}
						oninput={(e) => focusStore.updateSettings({ shortBreakMinutes: clampBreak(Number(e.currentTarget.value)) })}
					/>
				</div>
				<div class="field">
					<label for="cfg-long">Istirahat panjang</label>
					<input
						id="cfg-long"
						type="number"
						min="1"
						max="120"
						value={focusStore.settings.longBreakMinutes}
						oninput={(e) => focusStore.updateSettings({ longBreakMinutes: clampBreak(Number(e.currentTarget.value)) })}
					/>
				</div>
				<div class="field">
					<label for="cfg-cycle">Sesi sebelum istirahat panjang</label>
					<input
						id="cfg-cycle"
						type="number"
						min="1"
						max="12"
						value={focusStore.settings.sessionsBeforeLongBreak}
						oninput={(e) =>
							focusStore.updateSettings({
								sessionsBeforeLongBreak: Math.max(1, Math.min(12, Math.round(Number(e.currentTarget.value) || 4)))
							})}
					/>
				</div>
			</div>
		</section>
	{/if}

	{#if recentSessions.length > 0}
		<section class="card" aria-labelledby="history-title">
			<h2 id="history-title" class="card-title">Sesi Terbaru</h2>
			<div class="table-scroll">
				<table class="session-table">
					<thead>
						<tr>
							<th scope="col">Waktu</th>
							<th scope="col">Fase</th>
							<th scope="col">Aktivitas</th>
							<th scope="col">Rencana</th>
							<th scope="col">Aktual</th>
							<th scope="col">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each recentSessions as s (s.id)}
							<tr>
								<td>{new Date(s.startedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
								<td>{phaseLabel(s.phase)}</td>
								<td>{s.activityName ?? '—'}</td>
								<td>{s.plannedMinutes} mnt</td>
								<td>{s.actualMinutes ?? '—'}{s.actualMinutes != null ? ' mnt' : ''}</td>
								<td>{statusLabel(s.status)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>
<style>
	.page-header {
		margin-bottom: var(--space-4);
	}

	.focus-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;
		padding: var(--space-8) var(--space-4);
		background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
		color: #fff;
		border-radius: var(--radius-lg);
	}

	.focus-phase {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.8rem;
		opacity: 0.8;
		margin: 0;
	}

	.focus-activity {
		font-size: 1.15rem;
		font-weight: 600;
		margin: 0;
	}

	.focus-clock {
		font-size: clamp(3rem, 14vw, 5rem);
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		margin: 0;
		line-height: 1;
	}

	.focus-clock.done {
		color: #4ade80;
	}

	.focus-bar {
		width: 100%;
		max-width: 24rem;
		height: 8px;
		background-color: rgba(255, 255, 255, 0.2);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.focus-bar-fill {
		display: block;
		height: 100%;
		background-color: #60a5fa;
		transition: width 0.3s ease;
	}

	.focus-controls {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		justify-content: center;
	}

	.focus-hint {
		font-size: 0.8rem;
		opacity: 0.7;
		margin: 0;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.mini-stat {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		background-color: var(--color-surface);
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-clay);
		padding: var(--space-4) var(--space-5);
	}

	.mini-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		border-radius: var(--radius-lg);
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
		box-shadow: var(--shadow-clay-sm);
	}

	.mini-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.mini-value {
		font-size: 1.5rem;
		font-weight: 800;
		line-height: 1.1;
	}

	.mini-label {
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}

	.start-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
		max-width: 22rem;
	}

	.start-row select {
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background-color: var(--color-surface);
		color: var(--color-text);
	}

	.start-buttons {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.config-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-3);
	}

	.session-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}

	.session-table th,
	.session-table td {
		text-align: left;
		padding: var(--space-2);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.danger-text {
		color: var(--color-danger);
	}

	@media (max-width: 900px) {
		.config-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.config-grid,
		.stat-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
