<script lang="ts">
	import type { DailyStats } from '$lib/utils/statistics';
	import { formatDisplayDate } from '$lib/utils/date';

	interface Props {
		days: DailyStats[];
	}

	let { days }: Props = $props();

	// Max total across the window drives the bar scale; never divide by zero.
	const maxTotal = $derived(Math.max(1, ...days.map((day) => day.total)));
</script>

<div class="chart">
	<div class="chart-header">
		<h3 class="chart-title">Aktivitas 7 Hari Terakhir</h3>
		<p class="chart-legend muted text-sm">
			<span class="legend-dot"></span> Total aktivitas per hari
		</p>
	</div>

	<div class="bars" role="list" aria-label="Grafik aktivitas 7 hari terakhir">
		{#each days as day (day.date)}
			<div class="bar-column" role="listitem">
				<div class="bar-track" title="{formatDisplayDate(day.date)}: {day.completed}/{day.total}
					selesai">
					<div
						class="bar-fill"
						style:height="{day.total === 0 ? 0 : Math.max(8, (day.total / maxTotal) * 100)}%"
					></div>
				</div>
				<span class="bar-value">{day.total}</span>
				<span class="bar-label">{day.label}</span>
			</div>
		{/each}
	</div>

	<table class="sr-only">
		<caption>Tabel statistik 7 hari terakhir</caption>
		<thead>
			<tr><th>Tanggal</th><th>Total</th><th>Selesai</th><th>Durasi (menit)</th></tr>
		</thead>
		<tbody>
			{#each days as day (day.date)}
				<tr>
					<td>{formatDisplayDate(day.date)}</td>
					<td>{day.total}</td>
					<td>{day.completed}</td>
					<td>{day.totalDuration}</td>
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
		height: 11rem;
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

	.bar-fill {
		width: 100%;
		background-color: var(--color-primary);
		background-image: linear-gradient(180deg, #6bb3f0, #3d92e2);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.3s ease;
		min-height: 0;
	}

	.bar-value {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.bar-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}
</style>
