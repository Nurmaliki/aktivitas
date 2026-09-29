<script lang="ts">
	import type { DailyStepStats } from '$lib/types/steps';
	import { formatDisplayDate } from '$lib/utils/date';

	interface Props {
		days: DailyStepStats[];
		goal: number;
		/** Optional heading override. */
		title?: string;
	}

	let { days, goal, title = 'Langkah 7 Hari Terakhir' }: Props = $props();

	// Scale to the larger of the goal and the biggest day, so the goal line is
	// always visible and we never divide by zero.
	const maxValue = $derived(Math.max(1, goal, ...days.map((day) => day.steps)));
</script>

<div class="chart">
	<div class="chart-header">
		<h3 class="chart-title">{title}</h3>
		<p class="chart-legend muted text-sm">
			<span class="legend-dot"></span> Garis putus-putus = target {goal.toLocaleString('id-ID')}
		</p>
	</div>

	<div class="bars" role="list" aria-label="Grafik langkah 7 hari terakhir">
		{#each days as day (day.date)}
			<div class="bar-column" role="listitem">
				<span class="bar-value">{day.steps > 0 ? day.steps.toLocaleString('id-ID') : ''}</span>
				<div class="bar-track" title="{formatDisplayDate(day.date)}: {day.steps.toLocaleString(
					'id-ID'
				)} langkah">
					{#if goal > 0}
						<div class="goal-tick" style:bottom="{(goal / maxValue) * 100}%" aria-hidden="true"
						></div>
					{/if}
					<div
						class="bar-fill"
						class:goal-met={goal > 0 && day.steps >= goal}
						style:height="{day.steps === 0 ? 0 : Math.max(6, (day.steps / maxValue) * 100)}%"
					></div>
				</div>
				<span class="bar-label">{day.label}</span>
			</div>
		{/each}
	</div>

	<table class="sr-only">
		<caption>Tabel langkah 7 hari terakhir</caption>
		<thead>
			<tr><th>Tanggal</th><th>Langkah</th><th>Progress target</th></tr>
		</thead>
		<tbody>
			{#each days as day (day.date)}
				<tr>
					<td>{formatDisplayDate(day.date)}</td>
					<td>{day.steps}</td>
					<td>{day.goalProgress}%</td>
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
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.legend-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background-color: var(--color-primary);
		display: inline-block;
	}

	.bars {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: var(--space-2);
		align-items: end;
		height: 12rem;
	}

	.bar-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		height: 100%;
		justify-content: flex-end;
	}

	.bar-track {
		position: relative;
		flex: 1;
		width: 100%;
		max-width: 2.75rem;
		display: flex;
		align-items: flex-end;
		background-color: var(--color-surface-alt);
		border-radius: var(--radius-sm);
		overflow: hidden;
		box-shadow: var(--shadow-clay-inset);
	}

	.goal-tick {
		position: absolute;
		left: 0;
		right: 0;
		border-top: 2px dashed var(--color-warning);
		opacity: 0.8;
		z-index: 2;
	}

	.bar-fill {
		width: 100%;
		background-color: var(--color-primary);
		background-image: linear-gradient(180deg, #6bb3f0, #3d92e2);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.3s ease;
	}

	.bar-fill.goal-met {
		background-color: var(--color-success);
		background-image: linear-gradient(180deg, #79d6ba, #4bbd97);
	}

	.bar-value {
		font-size: 0.72rem;
		font-weight: 700;
		color: var(--color-text-muted);
		min-height: 0.9rem;
	}

	.bar-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}
</style>
