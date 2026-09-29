<script lang="ts">
	import { onMount } from 'svelte';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { stepStore } from '$lib/stores/steps.svelte.js';
	import { habitStore } from '$lib/stores/habit.svelte.js';
	import { focusStore } from '$lib/stores/focus.svelte.js';
	import { getLocalDateString, formatHeaderDate } from '$lib/utils/date';
	import { formatDuration, getMonthlyStats, getWeeklyStats } from '$lib/utils/statistics';
	import { getMonthlyStepStats, computeStepStats } from '$lib/utils/stepStatistics';
	import { exportData, parseBackupText, importData, type BackupValidationResult } from '$lib/services/backup';
	import StatCard from '$lib/components/StatCard.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import MonthlyChart from '$lib/components/MonthlyChart.svelte';
	import StepsChart from '$lib/components/StepsChart.svelte';
	import AnalyticsPanel from '$lib/components/AnalyticsPanel.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import SyncStatus from '$lib/components/SyncStatus.svelte';

	let today = $state('');
	onMount(() => {
		today = getLocalDateString();
	});

	const reference = $derived(today || getLocalDateString());
	const monthly = $derived(getMonthlyStats(activityStore.activities, reference));
	const weekly = $derived(getWeeklyStats(activityStore.activities, 7, reference));

	// Step statistics (derived from the step store).
	const stepMonthly = $derived(
		getMonthlyStepStats(stepStore.records, reference, stepStore.goal)
	);
	const stepOverall = $derived(computeStepStats(stepStore.records));

	// Selected day inside the monthly chart.
	let selectedDate = $state<string | null>(null);
	const selectedDayStats = $derived(
		selectedDate ? monthly.daily.find((day) => day.date === selectedDate) ?? null : null
	);
	const selectedDaySteps = $derived(
		selectedDate ? stepMonthly.daily.find((day) => day.date === selectedDate) ?? null : null
	);

	// ----- Backup / restore state -----
	let importInput = $state<HTMLInputElement | null>(null);
	let modeDialog = $state<HTMLDialogElement | null>(null);
	let pendingImport = $state<BackupValidationResult | null>(null);
	let pendingFileName = $state('');
	let replaceConfirmOpen = $state(false);
	let actionMessage = $state('');
	let actionError = $state('');
	let busy = $state(false);

	// Keep the native <dialog> in sync with whether an import is pending.
	$effect(() => {
		const el = modeDialog;
		if (!el) return;
		if (pendingImport && !el.open) el.showModal();
		if (!pendingImport && el.open) el.close();
	});

	async function handleExport() {
		actionMessage = '';
		actionError = '';
		busy = true;
		try {
			const summary = await exportData();
			actionMessage = `Berhasil mengekspor ${summary.activities} aktivitas, ${summary.steps} hari data langkah, ${summary.habits} kebiasaan, ${summary.habitLogs} log kebiasaan, dan ${summary.focusSessions} sesi fokus.`;
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Gagal mengekspor data.';
		} finally {
			busy = false;
		}
	}

	async function handleFileSelected(event: Event) {
		actionMessage = '';
		actionError = '';
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		try {
			const text = await file.text();
			const result = parseBackupText(text);
			if (!result.valid) {
				actionError = result.error ?? 'File backup tidak valid.';
				return;
			}
			pendingImport = result;
			pendingFileName = file.name;
		} catch {
			actionError = 'Gagal membaca file. Pastikan file berisi JSON yang valid.';
		} finally {
			// Allow re-selecting the same file.
			target.value = '';
		}
	}

	async function runImport(mode: 'merge' | 'replace') {
		if (!pendingImport) return;
		busy = true;
		actionError = '';
		try {
			const result = await importData(pendingImport, mode);
			await activityStore.refresh();
			await stepStore.refresh();
			await habitStore.refresh();
			await focusStore.refresh();
			actionMessage =
				mode === 'replace'
					? `Berhasil mengganti data dengan ${result.activities} aktivitas, ${result.steps} hari data langkah, ${result.habits} kebiasaan, dan ${result.focusSessions} sesi fokus dari "${pendingFileName}".`
					: `Berhasil menggabungkan data dari "${pendingFileName}" (${result.activities} aktivitas baru, ${result.habits} kebiasaan baru).`;
			pendingImport = null;
			pendingFileName = '';
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Gagal mengimpor data dari file backup.';
		} finally {
			busy = false;
			replaceConfirmOpen = false;
		}
	}

	function cancelImport() {
		pendingImport = null;
		pendingFileName = '';
		replaceConfirmOpen = false;
	}
</script>

<svelte:head>
	<title>Statistik — Daily Activity</title>
	<meta name="description" content="Statistik aktivitas harian, mingguan, dan bulanan." />
</svelte:head>

<div class="container page">
	<header class="page-header">
		<h1>Statistik</h1>
		<p class="subtitle">Analisis produktivitas Anda per hari, minggu, dan bulan.</p>
		<p class="today">Periode: {monthly.monthLabel}</p>
	</header>

	{#if activityStore.error}
		<div class="alert alert-error" role="alert">{activityStore.error}</div>
	{/if}
	{#if actionMessage}
		<div class="alert alert-success" role="status">{actionMessage}</div>
	{/if}
	{#if actionError}
		<div class="alert alert-error" role="alert">{actionError}</div>
	{/if}

	{#if activityStore.loading && !activityStore.initialized}
		<div class="alert alert-info" role="status">Memuat statistik…</div>
	{:else if activityStore.activities.length === 0}
		<section class="card">
			<div class="empty-state">
				<div class="empty-icon" aria-hidden="true">📊</div>
				<p class="empty-title">Belum cukup data untuk menampilkan statistik.</p>
				<p class="empty-message">
					Tambahkan aktivitas terlebih dahulu untuk melihat analisis produktivitas Anda.
				</p>
				<a class="btn btn-primary" href="/">Tambah Aktivitas</a>
			</div>
		</section>
	{:else}
		<section aria-label="Statistik bulan ini">
			<h2 class="section-heading">Bulan Ini — {monthly.monthLabel}</h2>
			<div class="stat-grid">
				<StatCard
					label="Total Aktivitas"
					value={String(monthly.stats.total)}
					hint="bulan berjalan"
					accent="primary"
				/>
				<StatCard
					label="Selesai"
					value={String(monthly.stats.completed)}
					hint="{monthly.stats.pending} belum selesai"
					accent="success"
				/>
				<StatCard
					label="Completion Rate"
					value="{monthly.stats.completionRate}%"
					hint="tingkat penyelesaian"
				/>
				<StatCard
					label="Total Waktu"
					value={formatDuration(monthly.stats.totalDuration)}
					hint="{formatDuration(monthly.stats.completedDuration)} selesai"
				/>
			</div>
			<div class="mini-grid">
				<StatCard
					label="Rata-rata per Hari"
					value={String(monthly.averageActivitiesPerDay)}
					hint="aktivitas per hari aktif"
				/>
				<StatCard
					label="Rata-rata Durasi"
					value={formatDuration(monthly.averageDurationPerActivity)}
					hint="per aktivitas"
				/>
				<StatCard
					label="Kategori Terbanyak"
					value={monthly.topCategory ?? '—'}
					hint="paling sering digunakan"
				/>
			</div>
			<div class="progress-card">
				<ProgressBar value={monthly.stats.completionRate} label="Completion rate bulan ini" />
			</div>
		</section>

		<section class="card" aria-labelledby="monthly-chart-title">
			<h2 id="monthly-chart-title" class="sr-only">Grafik aktivitas harian bulan ini</h2>
			<MonthlyChart
				days={monthly.daily}
				monthLabel={monthly.monthLabel}
				onSelect={(date) => (selectedDate = selectedDate === date ? null : date)}
				{selectedDate}
			/>
			{#if selectedDayStats}
				<div class="selected-detail">
					<h3 class="detail-title">{formatHeaderDate(selectedDayStats.date)}</h3>
					<div class="detail-row">
						<span>Total aktivitas</span>
						<strong>{selectedDayStats.total}</strong>
					</div>
					<div class="detail-row">
						<span>Selesai</span>
						<strong>{selectedDayStats.completed}</strong>
					</div>
					<div class="detail-row">
						<span>Total waktu</span>
						<strong>{formatDuration(selectedDayStats.totalDuration)}</strong>
					</div>
				</div>
			{/if}
		</section>

		<section class="card" aria-labelledby="category-title">
			<h2 id="category-title" class="card-title">Aktivitas per Kategori</h2>
			<p class="card-subtitle">Distribusi berdasarkan total durasi (menit).</p>

			{#if monthly.categories.length === 0}
				<p class="muted text-sm" style="margin-top: 1rem;">Belum ada data kategori bulan ini.</p>
			{:else}
				<ul class="category-list">
					{#each monthly.categories as entry (entry.category)}
						<li class="category-row">
							<div class="category-head">
								<span class="category-name">{entry.category}</span>
								<span class="category-value">
									{formatDuration(entry.totalDuration)} • {entry.percentage}%
								</span>
							</div>
							<div class="category-bar" aria-hidden="true">
								<div class="category-fill" style:width="{entry.percentage}%"></div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="card" aria-labelledby="weekly-summary-title">
			<h2 id="weekly-summary-title" class="card-title">Ringkasan 7 Hari Terakhir</h2>
			<div class="table-scroll">
				<table class="weekly-table">
					<thead>
						<tr>
							<th scope="col">Tanggal</th>
							<th scope="col">Aktivitas</th>
							<th scope="col">Selesai</th>
							<th scope="col">Durasi</th>
						</tr>
					</thead>
					<tbody>
						{#each weekly as day (day.date)}
							<tr>
								<td>{formatHeaderDate(day.date)}</td>
								<td>{day.total}</td>
								<td>{day.completed}</td>
								<td>{formatDuration(day.totalDuration)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<AnalyticsPanel {today} />

	<section class="card" aria-labelledby="steps-stats-title">
		<div class="spread">
			<div>
				<h2 id="steps-stats-title" class="card-title">Statistik Langkah</h2>
				<p class="card-subtitle">
					Target harian {stepStore.goal.toLocaleString('id-ID')} langkah · {stepOverall.days} hari
					terekam
				</p>
			</div>
		</div>

		{#if stepStore.records.length === 0}
			<div class="empty-state">
				<div class="empty-icon" aria-hidden="true">👟</div>
				<p class="empty-title">Belum ada data langkah.</p>
				<p class="empty-message">
					Catat langkah dari dashboard (input manual, sensor, atau impor file) untuk melihat
					statistiknya di sini.
				</p>
				<a class="btn btn-primary" href="/">Catat Langkah</a>
			</div>
		{:else}
			<div class="stat-grid mini">
				<StatCard
					label="Total Langkah"
					value={stepOverall.totalSteps.toLocaleString('id-ID')}
					hint="seluruh riwayat"
					accent="primary"
				/>
				<StatCard
					label="Rata-rata Harian"
					value={stepOverall.averageSteps.toLocaleString('id-ID')}
					hint="per hari terekam"
					accent="success"
				/>
				<StatCard
					label="Hari Terbaik"
					value={stepOverall.bestDaySteps.toLocaleString('id-ID')}
					hint={stepOverall.bestDayDate ? formatHeaderDate(stepOverall.bestDayDate) : '—'}
				/>
				<StatCard
					label="Perkiraan Jarak"
					value="{stepOverall.totalDistanceKm} km"
					hint="≈ {stepOverall.totalCalories.toLocaleString('id-ID')} kkal"
				/>
			</div>

			<div class="mini-grid">
				<StatCard
					label="Total Bulan Ini"
					value={stepMonthly.stats.totalSteps.toLocaleString('id-ID')}
					hint={stepMonthly.monthLabel}
				/>
				<StatCard
					label="Hari Aktif"
					value={String(stepMonthly.activeDays)}
					hint="hari ada langkah"
				/>
				<StatCard
					label="Target Tercapai"
					value="{stepMonthly.daysGoalMet} hari"
					hint="≥ target harian"
				/>
			</div>

			<div class="steps-chart-wrapper">
				<StepsChart
					days={stepMonthly.daily}
					monthLabel={stepMonthly.monthLabel}
					goal={stepStore.goal}
					onSelect={(date) => (selectedDate = selectedDate === date ? null : date)}
					{selectedDate}
				/>
			</div>
			{#if selectedDaySteps}
				<div class="selected-detail">
					<h3 class="detail-title">{formatHeaderDate(selectedDaySteps.date)}</h3>
					<div class="detail-row">
						<span>Langkah</span>
						<strong>{selectedDaySteps.steps.toLocaleString('id-ID')}</strong>
					</div>
					<div class="detail-row">
						<span>Progress target</span>
						<strong>{selectedDaySteps.goalProgress}%</strong>
					</div>
					{#if selectedDayStats}
						<div class="detail-row">
							<span>Aktivitas</span>
							<strong>{selectedDayStats.total}</strong>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</section>

	<section class="card" aria-labelledby="backup-title">
		<h2 id="backup-title" class="card-title">Backup & Restore Data</h2>
		<p class="card-subtitle">
			Data disimpan di browser ini. Ekspor secara berkala untuk menghindari kehilangan data.
		</p>

		<div class="backup-actions">
			<button
				type="button"
				class="btn btn-primary"
				onclick={handleExport}
				disabled={busy || activityStore.importing}
			>
				Export Data (JSON)
			</button>
			<button
				type="button"
				class="btn btn-secondary"
				onclick={() => importInput?.click()}
				disabled={busy || activityStore.importing}
			>
				{activityStore.importing ? 'Mengimpor…' : 'Import Data'}
			</button>
			<input
				bind:this={importInput}
				type="file"
				accept="application/json,.json"
				class="file-input"
				onchange={handleFileSelected}
			/>
		</div>

		<p class="backup-hint">
			Impor akan menanyakan apakah Anda ingin <strong>menggabungkan</strong> atau
			<strong>mengganti</strong> data yang ada.
		</p>
	</section>

	<SyncStatus />
</div>

<!-- Step 1: choose the import mode after a valid file is selected. -->
<dialog
	bind:this={modeDialog}
	class="mode-dialog"
	aria-labelledby="import-mode-title"
	oncancel={(event) => {
		event.preventDefault();
		cancelImport();
	}}
>
	<div class="mode-body">
		<h2 id="import-mode-title" class="mode-title">Impor data backup</h2>
		<p class="mode-message">
			Ditemukan <strong>{pendingImport?.activities.length ?? 0}</strong> aktivitas{pendingImport &&
			pendingImport.hasSteps
				? `, ${pendingImport.steps.length} hari data langkah`
				: ''}{pendingImport && pendingImport.habits.length > 0
				? `, ${pendingImport.habits.length} kebiasaan`
				: ''}{pendingImport && pendingImport.focusSessions.length > 0
				? `, ${pendingImport.focusSessions.length} sesi fokus`
				: ''} pada <strong>"{pendingFileName}"</strong>. Pilih cara mengimpor data.
		</p>
		<ul class="mode-options">
			<li><strong>Gabungkan</strong> — tambahkan aktivitas baru tanpa menghapus data yang ada.</li>
			<li><strong>Ganti semua</strong> — hapus seluruh data lama, lalu isi dari file backup.</li>
		</ul>
		<div class="mode-actions">
			<button type="button" class="btn btn-secondary" onclick={cancelImport} disabled={busy}>
				Batal
			</button>
			<button
				type="button"
				class="btn btn-danger"
				onclick={() => (replaceConfirmOpen = true)}
				disabled={busy}
			>
				Ganti semua
			</button>
			<button
				type="button"
				class="btn btn-primary"
				onclick={() => runImport('merge')}
				disabled={busy}
			>
				{busy ? 'Mengimpor…' : 'Gabungkan'}
			</button>
		</div>
	</div>
</dialog>

<ConfirmDialog
	open={replaceConfirmOpen}
	title="Ganti seluruh data?"
	message="Semua aktivitas yang ada saat ini akan dihapus dan digantikan oleh data dari file backup. Tindakan ini tidak dapat dibatalkan."
	confirmLabel="Ya, ganti semua"
	danger
	busy={busy}
	onConfirm={() => runImport('replace')}
	onCancel={() => (replaceConfirmOpen = false)}
/>

<style>
	.section-heading {
		font-size: 1.1rem;
		font-weight: 700;
		margin-bottom: var(--space-4);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.mini-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-4);
	}

	.stat-grid.mini {
		margin-top: var(--space-4);
	}

	.steps-chart-wrapper {
		margin-top: var(--space-5);
		padding-top: var(--space-5);
		border-top: 1px solid var(--color-border);
	}

	.progress-card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-sm);
		padding: var(--space-4) var(--space-5);
		margin-top: var(--space-4);
	}

	.selected-detail {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 22rem;
	}

	.detail-title {
		font-size: 0.95rem;
		font-weight: 700;
		margin-bottom: var(--space-1);
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.detail-row strong {
		color: var(--color-text);
	}

	.category-list {
		list-style: none;
		margin: var(--space-4) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.category-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.category-head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		font-size: 0.875rem;
	}

	.category-name {
		font-weight: 600;
	}

	.category-value {
		color: var(--color-text-muted);
	}

	.category-bar {
		height: 0.4rem;
		background-color: var(--color-border);
		border-radius: var(--radius-full);
		overflow: hidden;
	}

	.category-fill {
		height: 100%;
		background-color: var(--color-primary);
		border-radius: var(--radius-full);
		transition: width 0.3s ease;
	}

	.weekly-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: var(--space-4);
		font-size: 0.875rem;
	}

	.weekly-table th,
	.weekly-table td {
		text-align: left;
		padding: 0.5rem 0.4rem;
		border-bottom: 1px solid var(--color-border);
	}

	.weekly-table th {
		color: var(--color-text-muted);
		font-weight: 600;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.backup-actions {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin-top: var(--space-4);
	}

	.file-input {
		display: none;
	}

	.mode-dialog {
		border: none;
		border-radius: var(--radius-lg);
		padding: 0;
		max-width: 30rem;
		width: calc(100% - 2rem);
		box-shadow: var(--shadow-lg);
		color: var(--color-text);
	}

	.mode-dialog::backdrop {
		background-color: rgba(15, 23, 42, 0.45);
	}

	.mode-body {
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.mode-title {
		font-size: 1.15rem;
		font-weight: 700;
	}

	.mode-message {
		font-size: 0.925rem;
		color: var(--color-text-muted);
	}

	.mode-options {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	.mode-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
		margin-top: var(--space-2);
		flex-wrap: wrap;
	}

	.backup-hint {
		margin-top: var(--space-3);
		font-size: 0.85rem;
		color: var(--color-text-muted);
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
		max-width: 28rem;
	}

	@media (max-width: 900px) {
		.stat-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.mini-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 560px) {
		.stat-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
