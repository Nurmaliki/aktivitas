<script lang="ts">
	import type { DailyStats } from '$lib/utils/statistics';
	import { formatDisplayDate } from '$lib/utils/date';

	interface Props {
		/** One entry per calendar day in the month. */
		days: DailyStats[];
		monthLabel: string;
		onSelect?: (date: string) => void;
		selectedDate?: string | null;
	}

	let { days, monthLabel, onSelect, selectedDate = null }: Props = $props();

	const maxTotal = $derived(Math.max(1, ...days.map((day) => day.total)));
</script>

<div class="chart">
	<div class="chart-header">
		<h3 class="chart-title">Aktivitas Harian — {monthLabel}</h3>
		<p class="chart-legend muted text-sm">Klik batang untuk melihat detail hari</p>
	</div>

	<div class="day-scroll table-scroll">
		<div class="day-grid" aria-label="Grafik aktivitas per tanggal pada {monthLabel}">
			{#each days as day (day.date)}
				<button
					type="button"
					class="day-cell"
					class:has-data={day.total > 0}
					class:selected={selectedDate === day.date}
					onclick={() => onSelect?.(day.date)}
					title="{formatDisplayDate(day.date)}: {day.completed}/{day.total} selesai ({day.totalDuration} menit)"
					aria-label="{formatDisplayDate(day.date)}: {day.total} aktivitas"
				>
					<span class="day-column" aria-hidden="true">
						<span
							class="day-bar"
							style:height="{day.total === 0 ? 0 : Math.max(10, (day.total / maxTotal) * 100)}%"
						></span>
					</span>
					<span class="day-label">{day.label}</span>
				</button>
			{/each}
		</div>
	</div>

	<table class="sr-only">
		<caption>Tabel statistik harian {monthLabel}</caption>
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

	.day-scroll {
		/* Thin scrollbar-aware wrapper so 31 bars don't get squashed on phones. */
		padding-bottom: var(--space-1);
	}

	.day-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(1.75rem, 1fr));
		gap: 0.35rem;
		align-items: end;
		min-width: 34rem;
	}

	@media (min-width: 720px) {
		.day-grid {
			min-width: 0;
		}
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
		max-width: 1.5rem;
		background-color: var(--color-border-strong);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		transition: height 0.3s ease, background-color 0.15s ease;
	}

	.has-data .day-bar {
		background-color: var(--color-primary);
	}

	.selected .day-bar {
		background-color: var(--color-primary-hover);
	}

	.day-label {
		font-size: 0.68rem;
		color: var(--color-text-muted);
		line-height: 1;
	}

	.has-data .day-label {
		font-weight: 700;
		color: var(--color-text);
	}
</style>
