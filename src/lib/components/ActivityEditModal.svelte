<script lang="ts">
	import {
		ACTIVITY_CATEGORIES,
		MAX_DESCRIPTION_LENGTH,
		MAX_NAME_LENGTH,
		type Activity,
		type ActivityCategory,
		type ActivityInput
	} from '$lib/types/activity';
	import { validateActivityInput, normalizeInput } from '$lib/utils/validation';
	import type { Subtask } from '$lib/types/common';
	import type { ReminderConfig } from '$lib/types/common';
	import SubtaskList from '$lib/components/SubtaskList.svelte';
	import ReminderSettings from '$lib/components/ReminderSettings.svelte';

	interface Props {
		activity: Activity | null;
		open: boolean;
		saving?: boolean;
		onSave: (id: string, changes: ActivityInput) => Promise<boolean>;
		onClose: () => void;
	}

	let { activity, open, saving = false, onSave, onClose }: Props = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	let name = $state('');
	let description = $state('');
	let category = $state<ActivityCategory>('Development');
	let date = $state('');
	let duration = $state(30);
	let completed = $state(false);
	let subtasks = $state<Subtask[]>([]);
	let reminder = $state<ReminderConfig | undefined>(undefined);
	let errors = $state<Record<string, string>>({});

	// Re-seed the form whenever the modal opens with a (new) activity.
	$effect(() => {
		if (open && activity) {
			name = activity.name;
			description = activity.description ?? '';
			category = activity.category;
			date = activity.date;
			duration = activity.duration;
			completed = activity.completed;
			subtasks = activity.subtasks ? [...activity.subtasks] : [];
			reminder = activity.reminder ? { ...activity.reminder } : undefined;
			errors = {};
		}
	});

	// Keep the <dialog> element in sync with the `open` prop.
	$effect(() => {
		const el = dialog;
		if (!el) return;
		if (open && !el.open) el.showModal();
		else if (!open && el.open) el.close();
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!activity) return;

		const raw = { name, description, category, date, duration };
		const validation = validateActivityInput(raw);
		if (!validation.valid) {
			errors = validation.errors as Record<string, string>;
			return;
		}
		errors = {};

		const input = normalizeInput({ ...raw, completed, subtasks, reminder });
		const ok = await onSave(activity.id, input);
		if (ok) onClose();
	}
</script>

<dialog
	bind:this={dialog}
	class="modal"
	aria-labelledby="edit-modal-title"
	oncancel={(event) => {
		event.preventDefault();
		if (!saving) onClose();
	}}
>
	{#if activity}
		<form class="modal-body" onsubmit={handleSubmit} novalidate>
			<header class="modal-header">
				<h2 id="edit-modal-title" class="modal-title">Edit Aktivitas</h2>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={onClose}
					disabled={saving}
					aria-label="Tutup dialog"
				>
					✕
				</button>
			</header>

			<div class="form-grid">
				<div class="field span-2">
					<label for="edit-name">Nama aktivitas</label>
					<input
						id="edit-name"
						bind:value={name}
						type="text"
						maxlength={MAX_NAME_LENGTH}
						aria-invalid={errors.name ? 'true' : undefined}
					/>
					{#if errors.name}<span class="field-error">{errors.name}</span>{/if}
				</div>

				<div class="field span-2">
					<label for="edit-description">Deskripsi <span class="muted">(opsional)</span></label>
					<textarea
						id="edit-description"
						bind:value={description}
						maxlength={MAX_DESCRIPTION_LENGTH}
						rows="2"
					></textarea>
				</div>

				<div class="field">
					<label for="edit-category">Kategori</label>
					<select id="edit-category" bind:value={category}>
						{#each ACTIVITY_CATEGORIES as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label for="edit-date">Tanggal</label>
					<input
						id="edit-date"
						bind:value={date}
						type="date"
						aria-invalid={errors.date ? 'true' : undefined}
					/>
					{#if errors.date}<span class="field-error">{errors.date}</span>{/if}
				</div>

				<div class="field">
					<label for="edit-duration">Durasi (menit)</label>
					<input
						id="edit-duration"
						bind:value={duration}
						type="number"
						min="1"
						max="1440"
						step="5"
						inputmode="numeric"
						aria-invalid={errors.duration ? 'true' : undefined}
					/>
					{#if errors.duration}<span class="field-error">{errors.duration}</span>{/if}
				</div>

				<div class="field">
					<span class="field-label-spacer">Status</span>
					<label class="checkbox-row" for="edit-completed">
						<input id="edit-completed" type="checkbox" bind:checked={completed} />
						Sudah selesai
					</label>
				</div>
			</div>

			<div class="modal-subtasks">
				<SubtaskList
					subtasks={subtasks}
					disabled={saving}
					onChange={(next) => (subtasks = next)}
				/>
			</div>

			<div class="modal-reminder">
				<h3 class="modal-section-title">Pengingat</h3>
				<ReminderSettings value={reminder} disabled={saving} onChange={(next) => (reminder = next)} />
			</div>

			<footer class="modal-actions">
				<button type="button" class="btn btn-secondary" onclick={onClose} disabled={saving}>
					Batal
				</button>
				<button type="submit" class="btn btn-primary" disabled={saving}>
					{saving ? 'Menyimpan…' : 'Simpan Perubahan'}
				</button>
			</footer>
		</form>
	{/if}
</dialog>

<style>
	.modal {
		border: none;
		border-radius: var(--radius-lg);
		padding: 0;
		max-width: 34rem;
		width: calc(100% - 2rem);
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		box-shadow: var(--shadow-lg);
		color: var(--color-text);
	}

	.modal::backdrop {
		background-color: rgba(15, 23, 42, 0.45);
	}

	.modal-body {
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.modal-title {
		font-size: 1.15rem;
		font-weight: 700;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
	}

	.field-label-spacer {
		font-size: 0.85rem;
		font-weight: 600;
		min-height: 1.25rem;
	}

	.modal-subtasks {
		border-top: 1px solid var(--color-border);
		padding-top: var(--space-4);
	}

	.modal-reminder {
		border-top: 1px solid var(--color-border);
		padding-top: var(--space-4);
	}

	.modal-section-title {
		font-size: 0.95rem;
		font-weight: 700;
		margin-bottom: var(--space-2);
	}
</style>
