<script lang="ts">
	import type { ReminderConfig } from '$lib/types/common';
	import { SNOOZE_OPTIONS } from '$lib/types/common';
	import { reminderStore } from '$lib/stores/reminder.svelte.js';

	interface Props {
		value?: ReminderConfig;
		onChange?: (config: ReminderConfig) => void;
		disabled?: boolean;
	}

	let { value, onChange, disabled = false }: Props = $props();

	const config = $derived<ReminderConfig>(
		value ?? { enabled: false, sound: true, vibration: true, snoozeMinutes: 5 }
	);

	function patch(changes: Partial<ReminderConfig>) {
		onChange?.({ ...config, ...changes });
	}

	async function toggleEnabled(next: boolean) {
		patch({ enabled: next });
		if (next && reminderStore.permission === 'default') {
			await reminderStore.ensurePermission();
		}
	}
</script>

<div class="reminder-settings">
	<label class="reminder-toggle">
		<input
			type="checkbox"
			checked={config.enabled}
			disabled={disabled}
			onchange={(event) => toggleEnabled((event.currentTarget as HTMLInputElement).checked)}
		/>
		Aktifkan pengingat
	</label>

	{#if config.enabled}
		<div class="reminder-fields">
			<div class="field">
				<label for="reminder-time">Waktu pengingat</label>
				<input
					id="reminder-time"
					type="time"
					value={config.time ?? ''}
					disabled={disabled}
					oninput={(event) => patch({ time: (event.currentTarget as HTMLInputElement).value || undefined })}
				/>
				<span class="hint">Kosongkan untuk memakai waktu mulai dikurangi "sebelum".</span>
			</div>

			<div class="field">
				<label for="reminder-before">Menit sebelum mulai</label>
				<input
					id="reminder-before"
					type="number"
					min="0"
					max="240"
					step="5"
					value={config.minutesBefore ?? 0}
					disabled={disabled}
					oninput={(event) =>
						patch({ minutesBefore: Number((event.currentTarget as HTMLInputElement).value) })}
				/>
			</div>

			<div class="field">
				<label for="reminder-snooze">Snooze (menit)</label>
				<select
					id="reminder-snooze"
					value={config.snoozeMinutes}
					disabled={disabled}
					onchange={(event) =>
						patch({ snoozeMinutes: Number((event.currentTarget as HTMLSelectElement).value) })}
				>
					{#each SNOOZE_OPTIONS as option (option)}
						<option value={option}>{option} menit</option>
					{/each}
				</select>
			</div>

			<div class="reminder-checks">
				<label class="checkbox-row">
					<input
						type="checkbox"
						checked={config.sound}
						disabled={disabled}
						onchange={(event) => patch({ sound: (event.currentTarget as HTMLInputElement).checked })}
					/>
					Suara
				</label>
				<label class="checkbox-row">
					<input
						type="checkbox"
						checked={config.vibration}
						disabled={disabled}
						onchange={(event) => patch({ vibration: (event.currentTarget as HTMLInputElement).checked })}
					/>
					Getar
				</label>
			</div>

			{#if reminderStore.permission === 'denied'}
				<p class="permission-warning" role="status">
					Notifikasi sistem diblokir. Alarm tetap muncul saat aplikasi terbuka; aktifkan notifikasi di
					pengaturan browser untuk pengingat di luar tab.
				</p>
			{:else if reminderStore.permission === 'default'}
				<button type="button" class="btn btn-ghost btn-sm" onclick={() => reminderStore.ensurePermission()} disabled={disabled}>
					Izinkan notifikasi
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.reminder-settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.reminder-toggle {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
	}

	.reminder-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
	}

	.reminder-checks {
		display: flex;
		gap: var(--space-4);
		align-items: center;
	}

	.hint {
		font-size: 0.72rem;
		color: var(--color-text-subtle);
	}

	.permission-warning {
		grid-column: 1 / -1;
		font-size: 0.8rem;
		color: var(--color-warning, #92400e);
		background-color: var(--color-warning-soft, #fef3c7);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
	}

	@media (max-width: 560px) {
		.reminder-fields {
			grid-template-columns: 1fr;
		}
	}
</style>
