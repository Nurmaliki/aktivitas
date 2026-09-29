<script lang="ts">
	import type { DailyStepStats } from '$lib/types/steps';
	import { formatDisplayDate } from '$lib/utils/date';

	interface Props {
		/** One entry per calendar day. */
		days: DailyStepStats[];
		monthLabel: string;
		goal: number;
		onSelect?: (date: string) => void;
		selectedDate?: string | null;
	}

	let { days, monthLabel, goal, onSelect, selectedDate = null }: Props = $props();

	// Scale bars to the larger of the goal and the biggest day, so the goal line
	// is always meaningful and never divides by zero.
	const maxValue = $derived(Math.max(1, goal, ...days.map((day) => day.steps)));
	const goalPercent = $derived(goal > 0 ? Math.min(100, (goal / maxValue) * 100) : 0);
</script>

<div class="chart">
	<div class="chart-header">
		<div>
			<h3 class="chart-title">Langkah Harian — {monthLabel}</h3>
			<p class="chart-legend muted text-sm">
				Garis putus-putus = target {goal.toLocaleString('id-ID')} langkah
			</p>
		</div>
	</div>

	<div class="chart-body">
		{#if goal > 0}
			<div class="goal-line" style:bottom="{goalPercent}%" aria-hidden="true"></div>
		{/if}
		<div class="day-grid" aria-label="Grafik langkah per tanggal pada {monthLabel}">
			{#each days as day (day.date)}
				<button
					type="button"
					class="day-cell"
					class:has-data={day.steps > 0}
					class:goal-met={goal > 0 && day.steps >= goal}
					class:selected={selectedDate === day.date}
					onclick={() => onSelect?.(day.date)}
					title="{formatDisplayDate(day.date)}: {day.steps.toLocaleString('id-ID')} langkah"
					aria-label="{formatDisplayDate(day.date)}: {day.steps} langkah"
				>
					<span class="day-column" aria-hidden="true">
						<span
							class="day-bar"
							style:height="{day.steps === 0
								? 0
								: Math.max(4, (day.steps / maxValue) * 100)}%"
						></span>
					</span>
					<span class="day-label">{day.label}</span>
				</button>
			{/each}
		</div>
	</div>

	<table class="sr-only">
		<caption>Tabel langkah harian {monthLabel}</caption>
		<thead>
			<tr><th>Tanggal</th><th>Langkah</th></tr>
		</thead>
		<tbody>
			{#each days as day (day.date)}
				<tr>
					<td>{formatDisplayDate(day.date)}</td>
					<td>{day.steps}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.chart {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.chart-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.chart-title {
		font-size: 1.05rem;
		font-weight: 700;
	}

	.chart-legend {
		margin-top: 0.15rem;
	}

	.chart-body {
		position: relative;
		padding-top: 0.25rem;
	}

	.goal-line {
		position: absolute;
		left: 0;
		right: 0;
		border-top: 2px dashed var(--color-warning);
		opacity: 0.7;
		pointer-events: none;
		z-index: 1;
	}

	.day-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(1.5rem, 1fr));
		gap: 0.3rem;
		align-items: end;
		position: relative;
		z-index: 2;
	}

	.day-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		background: none;
		border: none;
		padding: 0.2rem 0 0;
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: background-color 0.15s ease;
	}

	.day-cell:hover {
		background-color: var(--color-surface-alt);
	}

	.day-cell.selected {
		background-color: var(--color-primary-soft);
	}

	.day-column {
		width: 100%;
		height: 5.5rem;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.day-bar {
		width: 70%;
		max-width: 1.4rem;
		background-color: var(--color-border-strong);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.3s ease, background-color 0.15s ease;
	}

	.has-data .day-bar {
		background-color: var(--color-primary);
	}

	.goal-met .day-bar {
		background-color: var(--color-success);
	}

	.day-label {
		font-size: 0.68rem;
		color: var(--color-text-muted);
		line-height: 1;
	}

	.goal-met .day-label {
		font-weight: 700;
		color: var(--color-success);
	}
</style>
