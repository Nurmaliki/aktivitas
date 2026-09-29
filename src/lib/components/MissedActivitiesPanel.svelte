<script lang="ts">
	import { onMount } from 'svelte';
	import type { Activity } from '$lib/types/activity';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { getLocalDateString } from '$lib/utils/date';
	import {
		findMissedActivities,
		missedMessage,
		rescheduleOptions,
		type RescheduleOption
	} from '$lib/utils/rescheduling';

	const MAX_SHOWN = 5;

	let today = $state('');
	onMount(() => {
		today = getLocalDateString();
	});

	// `now` is captured per render pass so options reflect the current time.
	const now = $derived(new Date());

	const missed = $derived(
		today ? findMissedActivities(activityStore.activities, today, now).slice(0, MAX_SHOWN) : []
	);

	async function apply(activity: Activity, option: RescheduleOption, setTime: boolean) {
		await activityStore.update(activity.id, {
			name: activity.name,
			category: activity.category,
			date: option.date,
			duration: activity.duration,
			completed: activity.completed,
			startTime: setTime ? option.startTime : activity.startTime,
			endTime: setTime ? option.endTime : activity.endTime,
			subtasks: activity.subtasks
		});
	}

	async function skip(activity: Activity) {
		await activityStore.setReminder(activity.id, { status: 'skipped' });
	}
</script>

{#if missed.length > 0}
	<section class="card missed" aria-labelledby="missed-title">
		<h2 id="missed-title" class="card-title">Perlu Dijadwalkan Ulang</h2>
		<p class="card-subtitle">Aktivitas yang belum selesai. Pilih tindakan — tidak ada yang dipindah otomatis.</p>

		<ul class="missed-list">
			{#each missed as item (item.activity.id)}
				{@const options = rescheduleOptions(item.activity, activityStore.activities, today, now)}
				<li class="missed-row">
					<p class="missed-msg">{missedMessage(item)}</p>
					<div class="missed-actions">
						{#each options as option (option.id)}
							<button
								type="button"
								class="btn btn-secondary btn-sm"
								disabled={activityStore.saving}
								onclick={() => apply(item.activity, option, true)}
							>
								{option.label}
							</button>
						{/each}
						<button
							type="button"
							class="btn btn-ghost btn-sm danger-text"
							disabled={activityStore.saving}
							onclick={() => skip(item.activity)}
						>
							Lewati
						</button>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.missed {
		border-left: 3px solid var(--color-warning, #f59e0b);
	}

	.missed-list {
		list-style: none;
		margin: var(--space-2) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.missed-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--color-border);
	}

	.missed-row:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.missed-msg {
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0;
	}

	.missed-actions {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.danger-text {
		color: var(--color-danger);
	}
</style>
