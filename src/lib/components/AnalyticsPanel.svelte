<script lang="ts">
	import { getLocalDateString } from '$lib/utils/date';
	import { formatDuration } from '$lib/utils/statistics';
	import { resolveRange, type RangePreset } from '$lib/utils/analytics';
	import { computeAnalytics } from '$lib/utils/analytics';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { stepStore } from '$lib/stores/steps.svelte.js';
	import { focusStore } from '$lib/stores/focus.svelte.js';
	import { habitStore } from '$lib/stores/habit.svelte.js';
	import EmptyIcon from '$lib/components/EmptyIcon.svelte';
	import InlineIcon from '$lib/components/InlineIcon.svelte';

	interface Props {
		/** Injected "today" so SSR and client agree (falls back to runtime). */
		today?: string;
	}

	let { today = '' }: Props = $props();

	const day = $derived(today || getLocalDateString());

	let preset = $state<RangePreset>('7d');
	let customFrom = $state('');
	let customTo = $state('');
	$effect(() => {
		if (day && !customFrom) {
			customFrom = day;
			customTo = day;
		}
	});

	const range = $derived(
		resolveRange(preset, day, preset === 'custom' ? { from: customFrom, to: customTo } : undefined)
	);

	const analytics = $derived(
		computeAnalytics({
			activities: activityStore.activities,
			focusSessions: focusStore.sessions,
			habits: habitStore.habits,
			habitLogs: habitStore.logs,
			steps: stepStore.records,
			range,
			today: day
		})
	);

	const k = $derived(analytics.kpis);

	// Chart scaling helpers.
	const maxPlanned = $derived(
		Math.max(1, ...analytics.daily.map((d) => Math.max(d.plannedMinutes, d.actualMinutes)))
	);
	const maxFocus = $derived(Math.max(1, ...analytics.daily.map((d) => d.focusMinutes)));

	function barHeight(value: number, max: number): string {
		return `${Math.round((value / max) * 100)}%`;
	}
</script>

<section class="card analytics" aria-labelledby="analytics-title">
	<div class="spread">
		<div>
			<h2 id="analytics-title" class="card-title">Analitik Lanjutan</h2>
			<p class="card-subtitle">{range.label}</p>
		</div>
		<div class="range-switch" role="tablist" aria-label="Rentang analitik">
			{#each [['7d', '7 Hari'], ['30d', '30 Hari'], ['thisMonth', 'Bulan Ini'], ['prevMonth', 'Bulan Lalu'], ['custom', 'Kustom']] as const as option (option[0])}
				<button
					type="button"
					role="tab"
					aria-selected={preset === option[0]}
					class="range-btn"
					class:active={preset === option[0]}
					onclick={() => (preset = option[0])}
				>
					{option[1]}
				</button>
			{/each}
		</div>
	</div>

	{#if preset === 'custom'}
		<div class="custom-range">
			<label>Dari <input type="date" bind:value={customFrom} /></label>
			<label>Sampai <input type="date" bind:value={customTo} /></label>
		</div>
	{/if}

	{#if k.totalActivities === 0 && k.pomodoroSessions === 0 && k.totalSteps === 0}
		<div class="empty-state">
			<EmptyIcon name="chart" size={26} />
			<p class="empty-title">Belum ada data pada rentang ini.</p>
			<p class="empty-message">Coba pilih rentang lain atau tambahkan aktivitas.</p>
		</div>
	{:else}
		<!-- KPI grid -->
		<div class="kpi-grid">
			<div class="kpi"><span class="kpi-value">{k.totalActivities}</span><span class="kpi-label">Total aktivitas</span></div>
			<div class="kpi"><span class="kpi-value">{k.completed}</span><span class="kpi-label">Selesai</span></div>
			<div class="kpi"><span class="kpi-value">{k.missed}</span><span class="kpi-label">Terlewat</span></div>
			<div class="kpi"><span class="kpi-value">{k.completionRate}%</span><span class="kpi-label">Tingkat selesai</span></div>
			<div class="kpi"><span class="kpi-value">{formatDuration(k.plannedDuration)}</span><span class="kpi-label">Durasi rencana</span></div>
			<div class="kpi"><span class="kpi-value">{formatDuration(k.actualDuration)}</span><span class="kpi-label">Durasi aktual</span></div>
			<div class="kpi"><span class="kpi-value">{formatDuration(k.focusedDuration)}</span><span class="kpi-label">Waktu fokus</span></div>
			<div class="kpi"><span class="kpi-value">{k.pomodoroSessions}</span><span class="kpi-label">Sesi pomodoro</span></div>
			<div class="kpi"><span class="kpi-value">{k.habitCompletionRate}%</span><span class="kpi-label">Konsistensi kebiasaan</span></div>
			<div class="kpi"><span class="kpi-value"><InlineIcon name="flame" /> {k.currentStreak}</span><span class="kpi-label">Streak saat ini</span></div>
			<div class="kpi"><span class="kpi-value">{k.averageFocusSession} mnt</span><span class="kpi-label">Rata-rata fokus</span></div>
			<div class="kpi"><span class="kpi-value">{k.averageStepsPerDay.toLocaleString('id-ID')}</span><span class="kpi-label">Rata-rata langkah/hari</span></div>
		</div>

		<div class="delta">
			Rencana vs aktual:
			<strong class:positive={k.plannedVsActualDiff >= 0} class:negative={k.plannedVsActualDiff < 0}>
				{k.plannedVsActualDiff >= 0 ? '+' : ''}{formatDuration(Math.abs(k.plannedVsActualDiff))}
			</strong>
			<span class="muted">{k.plannedVsActualDiff >= 0 ? 'lebih dari rencana' : 'kurang dari rencana'}</span>
		</div>

		<!-- Planned vs actual chart -->
		<div class="chart-block">
			<h3 class="chart-title">Rencana vs Aktual (per hari)</h3>
			<div class="bar-chart" role="img" aria-label="Grafik batang rencana vs aktual per hari">
				{#each analytics.daily as point (point.date)}
					<div class="bar-group">
						<div class="bars">
							<span class="bar planned" style="height: {barHeight(point.plannedMinutes, maxPlanned)}" title="Rencana {formatDuration(point.plannedMinutes)}"></span>
							<span class="bar actual" style="height: {barHeight(point.actualMinutes, maxPlanned)}" title="Aktual {formatDuration(point.actualMinutes)}"></span>
						</div>
						<span class="bar-label">{point.label}</span>
					</div>
				{/each}
			</div>
			<div class="legend">
				<span class="swatch planned"></span> Rencana
				<span class="swatch actual"></span> Aktual
			</div>
		</div>

		<!-- Focus time chart -->
		{#if k.focusedDuration > 0}
			<div class="chart-block">
				<h3 class="chart-title">Waktu Fokus (per hari)</h3>
				<div class="bar-chart" role="img" aria-label="Grafik batang waktu fokus per hari">
					{#each analytics.daily as point (point.date)}
						<div class="bar-group">
							<div class="bars">
								<span class="bar focus" style="height: {barHeight(point.focusMinutes, maxFocus)}" title="Fokus {formatDuration(point.focusMinutes)}"></span>
							</div>
							<span class="bar-label">{point.label}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Category distribution -->
		{#if analytics.categories.length > 0}
			<div class="chart-block">
				<h3 class="chart-title">Distribusi Kategori (menit)</h3>
				<ul class="category-list">
					{#each analytics.categories as cat (cat.category)}
						<li class="category-row">
							<span class="category-name">{cat.category}</span>
							<span class="category-bar" role="presentation">
								<span class="category-fill" style="width: {cat.percentage}%"></span>
							</span>
							<span class="category-val">{formatDuration(cat.duration)} · {cat.count}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Insights -->
		{#if analytics.insights.length > 0}
			<div class="chart-block">
				<h3 class="chart-title">Wawasan Produktivitas</h3>
				<ul class="insight-list">
					{#each analytics.insights as insight (insight.kind)}
						<li class="insight">{insight.text}</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}
</section>

<style>
	.analytics {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.spread {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.range-switch {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		background-color: var(--color-surface-alt);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		padding: 3px;
	}

	.range-btn {
		border: none;
		background: none;
		padding: 0.35rem 0.8rem;
		border-radius: var(--radius-full);
		font: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--color-text-muted);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.range-btn.active {
		background-color: var(--color-primary);
		color: #fff;
		font-weight: 600;
	}

	.custom-range {
		display: flex;
		gap: var(--space-4);
		flex-wrap: wrap;
		font-size: 0.85rem;
	}

	.custom-range label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.custom-range input {
		padding: 0.4rem 0.6rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-strong);
		background-color: var(--color-surface);
		color: var(--color-text);
	}

	.kpi-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-3);
	}

	.kpi {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--space-3);
		background-color: var(--color-surface-alt);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.kpi-value {
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		font-variant-numeric: tabular-nums;
	}

	.kpi-label {
		font-size: 0.75rem;
		color: var(--color-text-subtle);
	}

	.delta {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.delta strong.positive {
		color: var(--color-success);
	}

	.delta strong.negative {
		color: var(--color-danger, #c0392b);
	}

	.chart-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.chart-title {
		font-size: 0.95rem;
		font-weight: 700;
	}

	.bar-chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		height: 8rem;
		overflow-x: auto;
		padding-bottom: 2px;
	}

	.bar-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		flex: 1 0 auto;
		min-width: 1.75rem;
		height: 100%;
	}

	.bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 100%;
		width: 100%;
		justify-content: center;
	}

	.bar {
		width: 0.6rem;
		min-height: 2px;
		border-radius: var(--radius-full) var(--radius-full) 0 0;
		background-color: var(--color-primary);
		display: inline-block;
	}

	.bar.planned {
		background-color: #bae6fd;
	}
	.bar.actual {
		background-color: var(--color-primary);
	}
	.bar.focus {
		background-color: var(--color-success);
	}

	.bar-label {
		font-size: 0.68rem;
		color: var(--color-text-subtle);
	}

	.legend {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: 0.78rem;
		color: var(--color-text-muted);
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin-right: 4px;
	}

	.swatch.planned {
		background-color: #bae6fd;
	}
	.swatch.actual {
		background-color: var(--color-primary);
	}

	.category-list,
	.insight-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.category-row {
		display: grid;
		grid-template-columns: 6rem 1fr auto;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.85rem;
	}

	.category-bar {
		height: 0.6rem;
		background-color: var(--color-surface-alt);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.category-fill {
		display: block;
		height: 100%;
		background-color: var(--color-primary);
		border-radius: var(--radius-full);
	}

	.category-val {
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	.insight {
		font-size: 0.88rem;
		padding: var(--space-2) var(--space-3);
		background-color: var(--color-surface-alt);
		border-left: 3px solid var(--color-primary);
		border-radius: var(--radius-sm);
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

	@media (max-width: 900px) {
		.kpi-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.kpi-grid {
			grid-template-columns: 1fr;
		}

		.category-row {
			grid-template-columns: 5rem 1fr auto;
		}
	}
</style>
