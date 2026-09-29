<script lang="ts">
	import type { Habit, HabitFrequency, HabitInput } from '$lib/types/habit';
	import { ACTIVITY_CATEGORIES } from '$lib/types/activity';

	interface Props {
		saving?: boolean;
		onSubmit: (input: HabitInput) => Promise<boolean>;
		/** When set, the form edits an existing habit instead of creating one. */
		editing?: Habit | null;
		onCancelEdit?: () => void;
	}

	let { saving = false, onSubmit, editing = null, onCancelEdit }: Props = $props();

	const WEEKDAYS = [
		{ value: 0, label: 'Min' },
		{ value: 1, label: 'Sen' },
		{ value: 2, label: 'Sel' },
		{ value: 3, label: 'Rab' },
		{ value: 4, label: 'Kam' },
		{ value: 5, label: 'Jum' },
		{ value: 6, label: 'Sab' }
	];

	let name = $state('');
	let description = $state('');
	let categoryId = $state('');
	let frequency = $state<HabitFrequency>('daily');
	let daysOfWeek = $state<number[]>([1, 2, 3, 4, 5]);
	let targetPerPeriod = $state(1);
	let error = $state('');
	let success = $state('');

	$effect(() => {
		if (editing) {
			name = editing.name;
			description = editing.description ?? '';
			categoryId = editing.categoryId ?? '';
			frequency = editing.frequency;
			daysOfWeek = editing.daysOfWeek ? [...editing.daysOfWeek] : [1, 2, 3, 4, 5];
			targetPerPeriod = editing.targetPerPeriod;
			error = '';
			success = '';
		}
	});

	function reset() {
		name = '';
		description = '';
		categoryId = '';
		frequency = 'daily';
		daysOfWeek = [1, 2, 3, 4, 5];
		targetPerPeriod = 1;
	}

	function toggleDay(day: number) {
		daysOfWeek = daysOfWeek.includes(day)
			? daysOfWeek.filter((d) => d !== day)
			: [...daysOfWeek, day].sort();
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		success = '';
		error = '';

		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Nama kebiasaan wajib diisi.';
			return;
		}
		if ((frequency === 'custom' || frequency === 'weekly') && daysOfWeek.length === 0) {
			error = 'Pilih minimal satu hari.';
			return;
		}

		const input: HabitInput = {
			name: trimmed,
			description: description.trim() || undefined,
			categoryId: categoryId || undefined,
			frequency,
			daysOfWeek: frequency === 'custom' || frequency === 'weekly' ? daysOfWeek : undefined,
			targetPerPeriod: Math.max(1, Math.round(targetPerPeriod)),
			active: editing?.active ?? true
		};

		const ok = await onSubmit(input);
		if (ok) {
			if (!editing) {
				reset();
				success = 'Kebiasaan berhasil ditambahkan.';
			}
		} else {
			error = 'Gagal menyimpan kebiasaan.';
		}
	}
</script>

<section class="card" aria-labelledby="habit-form-title">
	<h2 id="habit-form-title" class="card-title">
		{editing ? 'Edit Kebiasaan' : 'Tambah Kebiasaan'}
	</h2>

	<form class="habit-form" onsubmit={handleSubmit} novalidate>
		<div class="field span-2">
			<label for="habit-name">Nama kebiasaan</label>
			<input id="habit-name" type="text" bind:value={name} maxlength="120" placeholder="Contoh: Minum air" />
		</div>

		<div class="field span-2">
			<label for="habit-desc">Deskripsi <span class="muted">(opsional)</span></label>
			<input id="habit-desc" type="text" bind:value={description} maxlength="300" />
		</div>

		<div class="field">
			<label for="habit-freq">Frekuensi</label>
			<select id="habit-freq" bind:value={frequency}>
				<option value="daily">Setiap hari</option>
				<option value="weekdays">Hari kerja (Sen–Jum)</option>
				<option value="weekly">Hari tertentu</option>
				<option value="custom">Kustom</option>
			</select>
		</div>

		<div class="field">
			<label for="habit-target">Target per periode</label>
			<input id="habit-target" type="number" min="1" max="100" bind:value={targetPerPeriod} />
		</div>

		<div class="field span-2">
			<label for="habit-category">Kategori <span class="muted">(opsional)</span></label>
			<select id="habit-category" bind:value={categoryId}>
				<option value="">— Tanpa kategori —</option>
				{#each ACTIVITY_CATEGORIES as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</div>

		{#if frequency === 'custom' || frequency === 'weekly'}
			<fieldset class="span-2 days-fieldset">
				<legend>Hari</legend>
				<div class="days-row">
					{#each WEEKDAYS as day (day.value)}
						<label class="day-check" class:checked={daysOfWeek.includes(day.value)}>
							<input
								type="checkbox"
								checked={daysOfWeek.includes(day.value)}
								onchange={() => toggleDay(day.value)}
							/>
							{day.label}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if error}<p class="field-error span-2" role="alert">{error}</p>{/if}
		{#if success}<p class="alert alert-success span-2" role="status">{success}</p>{/if}

		<div class="span-2 form-actions">
			<button type="submit" class="btn btn-primary" disabled={saving}>
				{saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Tambah Kebiasaan'}
			</button>
			{#if editing}
				<button type="button" class="btn btn-secondary" onclick={onCancelEdit} disabled={saving}>
					Batal
				</button>
			{/if}
		</div>
	</form>
</section>

<style>
	.habit-form {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.days-fieldset {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
	}

	.days-fieldset legend {
		font-size: 0.85rem;
		font-weight: 600;
		padding: 0 4px;
	}

	.days-row {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.day-check {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.85rem;
		padding: 2px 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.day-check.checked {
		background-color: var(--color-primary-soft);
		border-color: var(--color-primary);
	}

	@media (max-width: 560px) {
		.habit-form {
			grid-template-columns: 1fr;
		}
	}
</style>
