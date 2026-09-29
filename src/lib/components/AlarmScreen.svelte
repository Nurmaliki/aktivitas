<script lang="ts">
	import { reminderStore } from '$lib/stores/reminder.svelte.js';
	import { SNOOZE_OPTIONS } from '$lib/types/common';

	let busy = $state(false);

	async function startNow() {
		busy = true;
		await reminderStore.startNow();
		busy = false;
	}

	async function snooze(minutes: number) {
		busy = true;
		await reminderStore.snooze(minutes);
		busy = false;
	}
</script>

{#if reminderStore.active}
	<div
		class="alarm-screen"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="alarm-title"
		aria-describedby="alarm-desc"
	>
		<div class="alarm-inner">
			<p class="alarm-time">{reminderStore.active.time}</p>
			<h2 id="alarm-title" class="alarm-name">{reminderStore.active.activityName}</h2>
			<p id="alarm-desc" class="alarm-desc">Waktunya memulai aktivitas.</p>

			<button type="button" class="btn btn-primary alarm-start" onclick={startNow} disabled={busy}>
				Mulai Sekarang
			</button>

			<div class="alarm-snooze" role="group" aria-label="Snooze">
				<span class="alarm-snooze-label">Snooze</span>
				<div class="alarm-snooze-options">
					{#each SNOOZE_OPTIONS as option (option)}
						<button
							type="button"
							class="btn btn-secondary btn-sm"
							onclick={() => snooze(option)}
							disabled={busy}
						>
							{option} mnt
						</button>
					{/each}
				</div>
			</div>

			<button type="button" class="btn btn-ghost alarm-skip" onclick={() => reminderStore.skip()} disabled={busy}>
				Lewati
			</button>
		</div>
	</div>
{/if}

<style>
	.alarm-screen {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(160deg, #1e3a8a 0%, #0f172a 100%);
		color: #fff;
		padding: var(--space-6);
		text-align: center;
	}

	.alarm-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		max-width: 24rem;
		width: 100%;
	}

	.alarm-time {
		font-size: 3.5rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
		margin: 0;
	}

	.alarm-name {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
		word-break: break-word;
	}

	.alarm-desc {
		margin: 0;
		opacity: 0.85;
	}

	.alarm-start {
		font-size: 1.05rem;
		padding: 0.8rem 2rem;
		width: 100%;
		max-width: 18rem;
	}

	.alarm-snooze {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: var(--space-4);
	}

	.alarm-snooze-label {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.75;
	}

	.alarm-snooze-options {
		display: flex;
		gap: var(--space-2);
		justify-content: center;
		flex-wrap: wrap;
	}

	.alarm-skip {
		color: rgba(255, 255, 255, 0.85);
		text-decoration: underline;
	}

	.alarm-screen :global(.btn-secondary) {
		background-color: rgba(255, 255, 255, 0.12);
		color: #fff;
		border-color: rgba(255, 255, 255, 0.25);
	}

	@media (max-width: 480px) {
		.alarm-time {
			font-size: 2.75rem;
		}
	}
</style>
