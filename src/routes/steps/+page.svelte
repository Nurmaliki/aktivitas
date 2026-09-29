<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { stepStore } from '$lib/stores/steps.svelte.js';
	import {
		getLocalDateString,
		formatHeaderDate,
		formatDisplayDate
	} from '$lib/utils/date';
	import {
		computeStepStats,
		goalProgress,
		getWeeklyStepStats,
		getMonthlyStepStats,
		estimateDistanceKm,
		estimateCalories
	} from '$lib/utils/stepStatistics';
	import { parseStepFile } from '$lib/services/stepImport';
	import {
		MotionSensor,
		isMotionSupported,
		type SensorStatus
	} from '$lib/services/motionSensor';
	import { MIN_STEP_GOAL, MAX_STEP_GOAL, type StepRecord } from '$lib/types/steps';
	import StatCard from '$lib/components/StatCard.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StepsChart from '$lib/components/StepsChart.svelte';
	import WeeklyStepsChart from '$lib/components/WeeklyStepsChart.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	let today = $state('');
	onMount(() => {
		today = getLocalDateString();
	});

	const reference = $derived(today || getLocalDateString());

	// ----- Aggregates -----
	const overall = $derived(computeStepStats(stepStore.records));
	const weekly = $derived(getWeeklyStepStats(stepStore.records, 7, reference));
	const monthly = $derived(getMonthlyStepStats(stepStore.records, reference, stepStore.goal));
	const todaySteps = $derived(today ? stepStore.stepsFor(today) : 0);
	const todayProgress = $derived(goalProgress(todaySteps, stepStore.goal));
	const remaining = $derived(Math.max(0, stepStore.goal - todaySteps));

	// ----- Goal editing -----
	let goalInput = $state('');
	let feedback = $state('');
	let feedbackError = $state('');

	$effect(() => {
		// Keep the input in sync with the stored goal until the user edits it.
		if (!goalEditing) goalInput = String(stepStore.goal);
	});
	let goalEditing = $state(false);

	function showFeedback(message: string, isError = false) {
		if (isError) {
			feedbackError = message;
			feedback = '';
		} else {
			feedback = message;
			feedbackError = '';
		}
	}

	async function saveGoal() {
		const value = Number(goalInput);
		if (!Number.isFinite(value)) {
			showFeedback('Masukkan angka target yang valid.', true);
			return;
		}
		const ok = await stepStore.updateGoal(value);
		goalEditing = false;
		if (ok) {
			showFeedback(`Target harian diperbarui: ${stepStore.goal.toLocaleString('id-ID')} langkah.`);
		} else {
			showFeedback(stepStore.error ?? 'Gagal menyimpan target.', true);
		}
	}

	// ----- Manual entry -----
	let manualInput = $state('');

	async function addManual() {
		const delta = Number(manualInput);
		if (!Number.isFinite(delta) || delta === 0) {
			showFeedback('Masukkan jumlah langkah untuk ditambahkan.', true);
			return;
		}
		const ok = await stepStore.addSteps(reference, delta, 'manual');
		if (ok) {
			showFeedback(`Ditambahkan ${Math.round(delta).toLocaleString('id-ID')} langkah.`);
			manualInput = '';
		} else {
			showFeedback(stepStore.error ?? 'Gagal menambahkan langkah.', true);
		}
	}

	async function setManual() {
		const value = Number(manualInput);
		if (!Number.isFinite(value) || value < 0) {
			showFeedback('Masukkan total langkah yang valid (≥ 0).', true);
			return;
		}
		const ok = await stepStore.setSteps(reference, value, 'manual');
		if (ok) {
			showFeedback(`Total langkah hari ini: ${Math.round(value).toLocaleString('id-ID')}.`);
			manualInput = '';
		} else {
			showFeedback(stepStore.error ?? 'Gagal menyimpan langkah.', true);
		}
	}

	// ----- Sensor -----
	let sensorStatus = $state<SensorStatus>('unsupported');
	let sensorMessage = $state('');
	let sessionAdded = $state(0);
	let sensor: MotionSensor | null = null;
	let sessionStart = $state(0);

	onMount(() => {
		sensorStatus = isMotionSupported() ? 'ready' : 'unsupported';
	});

	onDestroy(() => {
		sensor?.stop();
	});

	async function toggleSensor() {
		if (sensorStatus === 'active' && sensor) {
			sensor.stop();
			sensor = null;
			await flushSensor();
			return;
		}
		sessionStart = stepStore.stepsFor(reference);
		sessionAdded = 0;
		const instance = new MotionSensor({
			onSteps: () => {
				sessionAdded = instance.stepCount;
			},
			onStatus: (status, message) => {
				sensorStatus = status;
				sensorMessage = message ?? '';
			}
		});
		sensor = instance;
		sensorStatus = await instance.start(sessionStart);
	}

	async function flushSensor() {
		if (sessionAdded <= 0) return;
		await stepStore.setSteps(reference, sessionStart + sessionAdded, 'sensor');
		showFeedback(`Langkah dari sensor disimpan: ${sessionAdded.toLocaleString('id-ID')}.`);
		sessionAdded = 0;
	}

	// Periodically persist while listening, so a refresh doesn't lose progress.
	$effect(() => {
		if (sensorStatus !== 'active') return;
		const interval = setInterval(() => {
			void flushSensor().then(() => {
				sessionStart = stepStore.stepsFor(reference);
			});
		}, 15000);
		return () => clearInterval(interval);
	});

	// ----- History table (grouped by date, editable) -----
	let editingDate = $state<string | null>(null);
	let editValue = $state('');

	function startEdit(record: StepRecord) {
		editingDate = record.date;
		editValue = String(record.steps);
	}

	async function commitEdit(date: string) {
		const value = Number(editValue);
		if (!Number.isFinite(value) || value < 0) {
			showFeedback('Nilai langkah tidak valid.', true);
			return;
		}
		const ok = await stepStore.setSteps(date, value, 'manual');
		editingDate = null;
		if (ok) showFeedback(`Data langkah ${formatDisplayDate(date)} disimpan.`);
		else showFeedback(stepStore.error ?? 'Gagal menyimpan.', true);
	}

	function cancelEdit() {
		editingDate = null;
	}

	// ----- Delete confirmation -----
	let deleting = $state<StepRecord | null>(null);
	let deleteBusy = $state(false);

	async function confirmDelete() {
		if (!deleting) return;
		deleteBusy = true;
		await stepStore.remove(deleting.date);
		deleteBusy = false;
		const label = formatDisplayDate(deleting.date);
		deleting = null;
		showFeedback(`Data langkah ${label} dihapus.`);
	}

	// ----- Import (CSV / JSON) -----
	let importInput = $state<HTMLInputElement | null>(null);
	let pendingImport = $state<StepRecord[] | null>(null);
	let pendingFileName = $state('');
	let pendingSkipped = $state(0);
	let replaceConfirmOpen = $state(false);

	async function handleFileSelected(event: Event) {
		feedback = '';
		feedbackError = '';
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			const result = parseStepFile(text, file.name);
			if (!result.valid) {
				feedbackError = result.error ?? 'File langkah tidak valid.';
				return;
			}
			pendingImport = result.records;
			pendingSkipped = result.skipped;
			pendingFileName = file.name;
		} catch {
			feedbackError = 'Gagal membaca file.';
		} finally {
			target.value = '';
		}
	}

	async function runImport(mode: 'merge' | 'replace') {
		if (!pendingImport) return;
		const count = pendingImport.length;
		await stepStore.runImport(pendingImport, mode);
		const error = stepStore.error;
		if (error) {
			feedbackError = error;
		} else {
			feedback =
				mode === 'replace'
					? `Berhasil mengganti data langkah dengan ${count} hari dari "${pendingFileName}".`
					: `Berhasil menggabungkan ${count} hari data langkah dari "${pendingFileName}".`;
			if (pendingSkipped > 0) feedback += ` ${pendingSkipped} baris dilewati.`;
		}
		pendingImport = null;
		pendingFileName = '';
		pendingSkipped = 0;
		replaceConfirmOpen = false;
	}

	function cancelImport() {
		pendingImport = null;
		pendingFileName = '';
		pendingSkipped = 0;
		replaceConfirmOpen = false;
	}

	const sensorLabel = $derived(
		sensorStatus === 'active'
			? 'Hentikan sensor'
			: sensorStatus === 'unsupported'
				? 'Sensor tidak tersedia'
				: 'Mulai hitung dengan sensor'
	);
	const sensorDisabled = $derived(
		sensorStatus === 'unsupported' || sensorStatus === 'denied' || stepStore.saving
	);
</script>

<svelte:head>
	<title>Langkah · Daily Activity</title>
	<meta name="description" content="Penghitung langkah harian dengan target, grafik, dan impor data." />
</svelte:head>

<div class="container page">
	<div class="page-header">
		<div>
			<h1 class="page-title">Penghitung Langkah</h1>
			<p class="page-subtitle">
				Pantau langkah harian dari sensor perangkat, input manual, atau impor file kesehatan.
			</p>
		</div>
		<p class="today-chip">{formatHeaderDate(reference)}</p>
	</div>

{#if stepStore.loading}
	<div class="alert alert-info" role="status">Memuat data langkah…</div>
{/if}

{#if feedback}
	<p class="alert alert-success" role="status">{feedback}</p>
{/if}
{#if feedbackError}
	<p class="alert alert-error" role="alert">{feedbackError}</p>
{/if}

<section class="card" aria-labelledby="today-steps-title">
	<h2 id="today-steps-title" class="sr-only">Langkah hari ini</h2>
	<div class="hero-top">
		<div class="hero-count">
			<span class="hero-number">{todaySteps.toLocaleString('id-ID')}</span>
			<span class="hero-unit">langkah hari ini</span>
		</div>
		<div class="hero-facts">
			<span>{estimateDistanceKm(todaySteps)} km</span>
			<span>≈ {estimateCalories(todaySteps)} kkal</span>
			<span>{todayProgress}% dari target</span>
		</div>
	</div>
	<ProgressBar value={todayProgress} label="Progress target harian" />
	<p class="hero-remaining muted">
		{#if remaining > 0}
			{remaining.toLocaleString('id-ID')} langkah lagi untuk mencapai target
			{stepStore.goal.toLocaleString('id-ID')}.
		{:else}
			🎉 Target harian tercapai!
		{/if}
	</p>
</section>

<section class="controls-grid" aria-label="Kontrol penghitung langkah">
	<div class="card">
		<h2 class="card-title">Input Manual</h2>
		<p class="card-subtitle">Tambahkan langkah atau isi total hari ini.</p>
		<div class="field">
			<label for="steps-manual">Jumlah langkah</label>
			<input
				id="steps-manual"
				type="number"
				min="0"
				step="1"
				inputmode="numeric"
				placeholder="misal 3500"
				bind:value={manualInput}
			/>
		</div>
		<div class="button-row">
			<button type="button" class="btn btn-primary" onclick={addManual} disabled={stepStore.saving}>
				+ Tambah
			</button>
			<button type="button" class="btn btn-secondary" onclick={setManual} disabled={stepStore.saving}>
				Set total
			</button>
		</div>
	</div>

	<div class="card">
		<h2 class="card-title">Target Harian</h2>
		<p class="card-subtitle">Saat ini {stepStore.goal.toLocaleString('id-ID')} langkah/hari.</p>
		<form class="field" onsubmit={(e) => (e.preventDefault(), saveGoal())}>
			<label for="steps-goal">Target (langkah)</label>
			<input
				id="steps-goal"
				type="number"
				min={MIN_STEP_GOAL}
				max={MAX_STEP_GOAL}
				step="500"
				inputmode="numeric"
				bind:value={goalInput}
				oninput={() => (goalEditing = true)}
			/>
			<button type="submit" class="btn btn-secondary" disabled={stepStore.saving}>
				Simpan target
			</button>
		</form>
	</div>

	<div class="card">
		<h2 class="card-title">Sensor Perangkat</h2>
		<p class="card-subtitle">
			Deteksi langkah dari akselerometer. Hanya di perangkat bersensor & selama halaman terbuka.
		</p>
		<button
			type="button"
			class="btn {sensorStatus === 'active' ? 'btn-danger' : 'btn-secondary'}"
			onclick={toggleSensor}
			disabled={sensorDisabled}
			aria-pressed={sensorStatus === 'active'}
		>
			{sensorLabel}
		</button>
		{#if sensorStatus === 'active'}
			<p class="sensor-status" role="status">
				Sesi aktif: <strong>{sessionAdded.toLocaleString('id-ID')}</strong> langkah terdeteksi
			</p>
		{:else if sensorMessage}
			<p class="muted text-sm">{sensorMessage}</p>
		{:else if sensorStatus === 'unsupported'}
			<p class="muted text-sm">
				Perangkat/tab ini tidak menyediakan sensor gerakan. Gunakan input manual atau impor.
			</p>
		{/if}
	</div>
</section>

<section aria-label="Statistik langkah">
	<div class="stat-grid">
		<StatCard
			label="Total Langkah"
			value={overall.totalSteps.toLocaleString('id-ID')}
			hint="seluruh riwayat"
			accent="primary"
		/>
		<StatCard
			label="Rata-rata Harian"
			value={overall.averageSteps.toLocaleString('id-ID')}
			hint="{overall.days} hari terekam"
			accent="success"
		/>
		<StatCard
			label="Hari Terbaik"
			value={overall.bestDaySteps.toLocaleString('id-ID')}
			hint={overall.bestDayDate ? formatDisplayDate(overall.bestDayDate) : '—'}
		/>
		<StatCard
			label="Perkiraan Jarak"
			value="{overall.totalDistanceKm} km"
			hint="≈ {overall.totalCalories.toLocaleString('id-ID')} kkal"
		/>
	</div>
</section>

{#if stepStore.records.length === 0}
	<section class="card">
		<div class="empty-state">
			<div class="empty-icon" aria-hidden="true">👟</div>
			<p class="empty-title">Belum ada data langkah.</p>
			<p class="empty-message">
				Tambahkan langkah lewat input manual, aktifkan sensor di perangkat mobile, atau impor file
				CSV/JSON dari aplikasi kesehatan Anda.
			</p>
			<button type="button" class="btn btn-primary" onclick={() => importInput?.click()}>
				Impor file langkah
			</button>
		</div>
	</section>
{:else}
	<section class="card" aria-labelledby="weekly-steps-title">
		<h2 id="weekly-steps-title" class="sr-only">Grafik langkah</h2>
		<WeeklyStepsChart days={weekly} goal={stepStore.goal} />
	</section>

	<section class="card" aria-labelledby="monthly-steps-title">
		<div class="spread">
			<div>
				<h2 id="monthly-steps-title" class="card-title">Bulan Ini — {monthly.monthLabel}</h2>
				<p class="card-subtitle">
					{monthly.activeDays} hari aktif · {monthly.daysGoalMet} hari mencapai target
				</p>
			</div>
		</div>
		<div class="monthly-wrap">
			<StepsChart
				days={monthly.daily}
				monthLabel={monthly.monthLabel}
				goal={stepStore.goal}
				selectedDate={editingDate}
				onSelect={(date) => {
					const record = stepStore.records.find((r) => r.date === date);
					if (record) startEdit(record);
				}}
			/>
		</div>
	</section>

	<section class="card" aria-labelledby="history-steps-title">
		<div class="spread">
			<div>
				<h2 id="history-steps-title" class="card-title">Riwayat Langkah</h2>
				<p class="card-subtitle">{stepStore.records.length} hari terekam</p>
			</div>
			<div class="header-actions">
				<button type="button" class="btn btn-secondary btn-sm" onclick={() => importInput?.click()}>
					Impor file
				</button>
			</div>
		</div>

		<div class="table-scroll table-wrapper">
			<table class="data-table">
				<thead>
					<tr>
						<th scope="col">Tanggal</th>
						<th scope="col">Langkah</th>
						<th scope="col">Progress</th>
						<th scope="col">Sumber</th>
						<th scope="col"><span class="sr-only">Aksi</span></th>
					</tr>
				</thead>
				<tbody>
					{#each stepStore.records as record (record.date)}
						<tr>
							<td>{formatDisplayDate(record.date)}</td>
							<td>
								{#if editingDate === record.date}
									<input
										class="inline-edit"
										type="number"
										min="0"
										step="1"
										inputmode="numeric"
										bind:value={editValue}
										aria-label="Langkah untuk {formatDisplayDate(record.date)}"
									/>
								{:else}
									<strong>{record.steps.toLocaleString('id-ID')}</strong>
								{/if}
							</td>
							<td>{goalProgress(record.steps, stepStore.goal)}%</td>
							<td><span class="badge">{record.source}</span></td>
							<td class="row-actions">
								{#if editingDate === record.date}
									<button
										type="button"
										class="btn btn-primary btn-xs"
										onclick={() => commitEdit(record.date)}
										disabled={stepStore.saving}
									>
										Simpan
									</button>
									<button type="button" class="btn btn-ghost btn-xs" onclick={cancelEdit}>
										Batal
									</button>
								{:else}
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										onclick={() => startEdit(record)}
									>
										Edit
									</button>
									<button
										type="button"
										class="btn btn-ghost btn-xs danger-text"
										onclick={() => (deleting = record)}
									>
										Hapus
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<section class="card" aria-labelledby="import-steps-title">
	<h2 id="import-steps-title" class="card-title">Impor Data Langkah</h2>
	<p class="card-subtitle">
		Impor file <strong>CSV</strong> atau <strong>JSON</strong> yang berisi kolom tanggal dan jumlah
		langkah (mis. hasil export Google Fit / Apple Health). Data divalidasi sebelum disimpan.
	</p>
	{#if pendingImport}
		<div class="pending-box">
			<p>
				<strong>{pendingImport.length}</strong> hari data langkah dari
				<strong>"{pendingFileName}"</strong>{pendingSkipped > 0
					? ` (${pendingSkipped} baris dilewati)`
					: ''}.
			</p>
			<div class="button-row">
				<button
					type="button"
					class="btn btn-primary"
					onclick={() => runImport('merge')}
					disabled={stepStore.saving}
				>
					Gabungkan (Merge)
				</button>
				<button
					type="button"
					class="btn btn-danger"
					onclick={() => (replaceConfirmOpen = true)}
					disabled={stepStore.saving}
				>
					Ganti semua (Replace)
				</button>
				<button
					type="button"
					class="btn btn-ghost"
					onclick={cancelImport}
					disabled={stepStore.saving}
				>
					Batal
				</button>
			</div>
		</div>
	{:else}
		<button type="button" class="btn btn-secondary" onclick={() => importInput?.click()}>
			Pilih file CSV/JSON
		</button>
	{/if}
	<input
		bind:this={importInput}
		type="file"
		accept=".csv,.json,application/json,text/csv"
		class="sr-only"
		aria-label="Impor data langkah dari file CSV atau JSON"
		onchange={handleFileSelected}
	/>
	<p class="muted text-sm disclaim">
		Angka jarak dan kalori adalah estimasi kasar, bukan pengukuran medis. Data sensor hanya perkiraan.
	</p>
</section>
</div>

<ConfirmDialog
	open={replaceConfirmOpen}
	title="Ganti semua data langkah?"
	message="Seluruh data langkah yang ada akan dihapus dan digantikan dengan data dari file. Aktivitas harian tidak terpengaruh. Tindakan ini tidak dapat dibatalkan."
	confirmLabel="Ya, ganti semua"
	danger
	onConfirm={() => runImport('replace')}
	onCancel={() => (replaceConfirmOpen = false)}
/>

<ConfirmDialog
	open={deleting !== null}
	title="Hapus data langkah?"
	message={deleting
		? `Data langkah ${formatDisplayDate(deleting.date)} (${deleting.steps.toLocaleString('id-ID')} langkah) akan dihapus.`
		: ''}
	confirmLabel="Hapus"
	danger
	busy={deleteBusy}
	onConfirm={confirmDelete}
	onCancel={() => (deleting = null)}
/>

<style>
	.page-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
	}

	.page-title {
		font-size: 1.75rem;
		font-weight: 700;
	}

	.page-subtitle {
		margin-top: var(--space-2);
		color: var(--color-text-muted);
		max-width: 42rem;
	}

	.today-chip {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: 0.4rem 0.85rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.hero-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		margin-bottom: var(--space-4);
	}

	.hero-count {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.hero-number {
		font-size: 3rem;
		font-weight: 700;
		line-height: 1;
		color: var(--color-primary);
	}

	.hero-unit {
		color: var(--color-text-muted);
	}

	.hero-facts {
		display: flex;
		gap: var(--space-4);
		flex-wrap: wrap;
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.hero-remaining {
		margin-top: var(--space-3);
		font-size: 0.9rem;
	}

	.controls-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.button-row {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
		margin-top: var(--space-3);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.sensor-status {
		margin-top: var(--space-3);
		font-size: 0.85rem;
		color: var(--color-success);
	}

	.monthly-wrap {
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
	}

	.header-actions {
		display: flex;
		gap: var(--space-2);
	}

	.table-wrapper {
		margin-top: var(--space-4);
	}

	.data-table {
		width: 100%;
		min-width: 32rem;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.data-table th,
	.data-table td {
		text-align: left;
		padding: 0.6rem 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.data-table th {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-muted);
	}

	.inline-edit {
		width: 7rem;
	}

	.row-actions {
		display: flex;
		gap: var(--space-1);
		flex-wrap: wrap;
	}

	.badge {
		display: inline-block;
		padding: 0.1rem 0.5rem;
		border-radius: var(--radius-full, 999px);
		background-color: var(--color-surface-alt);
		font-size: 0.75rem;
		color: var(--color-text-muted);
		text-transform: capitalize;
	}

	.danger-text {
		color: var(--color-danger, #c0392b);
	}

	.pending-box {
		margin-top: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background-color: var(--color-surface-alt);
	}

	.disclaim {
		margin-top: var(--space-4);
	}

	.btn-xs {
		padding: 0.25rem 0.6rem;
		font-size: 0.78rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-8) var(--space-4);
	}

	.empty-icon {
		font-size: 2rem;
	}

	.empty-title {
		font-size: 1.05rem;
		font-weight: 700;
	}

	.empty-message {
		font-size: 0.9rem;
		color: var(--color-text-muted);
		max-width: 30rem;
	}

	@media (max-width: 900px) {
		.controls-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 600px) {
		.controls-grid {
			grid-template-columns: 1fr;
		}
		.stat-grid {
			grid-template-columns: 1fr;
		}
		.hero-number {
			font-size: 2.4rem;
		}
	}
</style>
