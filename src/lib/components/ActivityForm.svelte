<script lang="ts">
	import {
		ACTIVITY_CATEGORIES,
		MAX_DESCRIPTION_LENGTH,
		MAX_NAME_LENGTH,
		type ActivityCategory,
		type ActivityInput
	} from '$lib/types/activity';
	import { getLocalDateString } from '$lib/utils/date';
	import { validateActivityInput, normalizeInput } from '$lib/utils/validation';

	interface Props {
		saving?: boolean;
		/** Called with a validated input; should return true when the save succeeded. */
		onSubmit: (input: ActivityInput) => Promise<boolean>;
	}

	let { saving = false, onSubmit }: Props = $props();

	let name = $state('');
	let description = $state('');
	let category = $state<ActivityCategory>('Development');
	let date = $state(getLocalDateString());
	let duration = $state(30);
	let completed = $state(false);

	let errors = $state<Record<string, string>>({});
	let successMessage = $state('');
	let nameInput = $state<HTMLInputElement | null>(null);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		successMessage = '';

		const raw = { name, description, category, date, duration };
		const validation = validateActivityInput(raw);
		if (!validation.valid) {
			errors = validation.errors as Record<string, string>;
			return;
		}
		errors = {};

		const input = normalizeInput({ ...raw, completed });
		const ok = await onSubmit(input);
		if (ok) {
			// Reset the form to its defaults after a successful save.
			name = '';
			description = '';
			category = 'Development';
			date = getLocalDateString();
			duration = 30;
			completed = false;
			successMessage = 'Aktivitas berhasil ditambahkan.';
			nameInput?.focus();
		}
	}

	function clearError(field: string) {
		if (errors[field]) {
			const next = { ...errors };
			delete next[field];
			errors = next;
		}
	}
</script>

<section class="card" aria-labelledby="add-activity-title">
	<h2 id="add-activity-title" class="card-title">Tambah Aktivitas</h2>
	<p class="card-subtitle">Catat aktivitas harian Anda dengan cepat.</p>

	<form class="form-grid" onsubmit={handleSubmit} novalidate>
		<div class="field span-2">
			<label for="activity-name">Nama aktivitas</label>
			<input
				id="activity-name"
				bind:this={nameInput}
				bind:value={name}
				type="text"
				placeholder="Contoh: Menulis dokumentasi API"
				maxlength={MAX_NAME_LENGTH}
				autocomplete="off"
				aria-invalid={errors.name ? 'true' : undefined}
				oninput={() => clearError('name')}
			/>
			{#if errors.name}<span class="field-error">{errors.name}</span>{/if}
		</div>

		<div class="field span-2">
			<label for="activity-description">Deskripsi <span class="muted">(opsional)</span></label>
			<textarea
				id="activity-description"
				bind:value={description}
				placeholder="Detail singkat aktivitas"
				maxlength={MAX_DESCRIPTION_LENGTH}
				rows="2"
			></textarea>
		</div>

		<div class="field">
			<label for="activity-category">Kategori</label>
			<select id="activity-category" bind:value={category}>
				{#each ACTIVITY_CATEGORIES as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="activity-date">Tanggal</label>
			<input
				id="activity-date"
				bind:value={date}
				type="date"
				aria-invalid={errors.date ? 'true' : undefined}
				oninput={() => clearError('date')}
			/>
			{#if errors.date}<span class="field-error">{errors.date}</span>{/if}
		</div>

		<div class="field">
			<label for="activity-duration">Durasi (menit)</label>
			<input
				id="activity-duration"
				bind:value={duration}
				type="number"
				min="1"
				max="1440"
				step="5"
				inputmode="numeric"
				aria-invalid={errors.duration ? 'true' : undefined}
				oninput={() => clearError('duration')}
			/>
			{#if errors.duration}<span class="field-error">{errors.duration}</span>{/if}
		</div>

		<div class="field">
			<span class="field-label-spacer">Status</span>
			<label class="checkbox-row" for="activity-completed">
				<input id="activity-completed" type="checkbox" bind:checked={completed} />
				Tandai sudah selesai
			</label>
		</div>

		<div class="span-2 form-actions">
			<button type="submit" class="btn btn-primary" disabled={saving}>
				{saving ? 'Menyimpan…' : 'Tambah Aktivitas'}
			</button>
		</div>

		{#if successMessage}
			<div class="span-2">
				<p class="alert alert-success" role="status">{successMessage}</p>
			</div>
		{/if}
	</form>
</section>

<style>
	.field-label-spacer {
		font-size: 0.85rem;
		font-weight: 600;
		min-height: 1.25rem;
	}
</style>
