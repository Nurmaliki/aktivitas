<script lang="ts">
	import type { Habit } from '$lib/types/habit';
	import { addDays, formatDisplayDate } from '$lib/utils/date';
	import { heatLevel } from '$lib/utils/habits';

	interface Props {
		habit: Habit;
		/** date -> completed log index. */
		logIndex: Map<string, import('$lib/types/habit').HabitLog>;
		today: string;
		/** Number of weeks to show (default 12). */
		weeks?: number;
	}

	let { habit, logIndex, today, weeks = 12 }: Props = $props();

	// Build columns (weeks) x rows (weekdays Mon..Sun).
	const columns = $derived.by(() => {
		// Align the last column's end to today, starting on Monday.
		const todayDate = new Date(today + 'T00:00:00');
		const weekday = (todayDate.getDay() + 6) % 7; // 0=Mon..6=Sun
		const lastMonday = addDays(today, -weekday);
		const firstMonday = addDays(lastMonday, -(weeks - 1) * 7);
		const cols: string[][] = [];
		for (let w = 0; w < weeks; w++) {
			const colMonday = addDays(firstMonday, w * 7);
			cols.push(Array.from({ length: 7 }, (_, d) => addDays(colMonday, d)));
		}
		return cols;
	});

	const levelLabels = ['Tidak dijadwalkan', 'Belum selesai', 'Sebagian', 'Hampir', 'Selesai'];
</script>

<div class="heatmap" role="img" aria-label="Heatmap konsistensi kebiasaan {habit.name}">
	{#each columns as column, ci (ci)}
		<div class="heat-col">
			{#each column as date (date)}
				{@const level = heatLevel(habit, logIndex, date, today)}
				<span
					class="heat-cell level-{level}"
					title="{formatDisplayDate(date)} — {levelLabels[level]}"
					aria-hidden="true"
				></span>
			{/each}
		</div>
	{/each}
</div>

<div class="heat-legend" aria-hidden="true">
	<span class="legend-label">Sedikit</span>
	{#each [0, 1, 2, 3, 4] as level (level)}
		<span class="heat-cell level-{level}"></span>
	{/each}
	<span class="legend-label">Banyak</span>
</div>

<style>
	.heatmap {
		display: flex;
		gap: 3px;
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.heat-col {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.heat-cell {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		background-color: var(--color-surface-alt, #e2e8f0);
		flex-shrink: 0;
	}

	.level-0 {
		background-color: var(--color-surface-alt, #eef2f6);
	}
	.level-1 {
		background-color: #cbd5e1;
	}
	.level-2 {
		background-color: #93c5fd;
	}
	.level-3 {
		background-color: #3b82f6;
	}
	.level-4 {
		background-color: #1d4ed8;
	}

	.heat-legend {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: var(--space-2);
		font-size: 0.7rem;
		color: var(--color-text-subtle);
	}

	.legend-label {
		margin: 0 2px;
	}
</style>
