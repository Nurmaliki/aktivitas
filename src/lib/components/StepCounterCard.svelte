<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { stepStore } from '$lib/stores/steps.svelte.js';
	import { getLocalDateString } from '$lib/utils/date';
	import { goalProgress, estimateDistanceKm, estimateCalories } from '$lib/utils/stepStatistics';
	import { MotionSensor, isMotionSupported, type SensorStatus } from '$lib/services/motionSensor';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import StepIcon from '$lib/components/StepIcon.svelte';

	interface Props {
		/**
		 * Compact mode shows only the summary + link to the Steps page (used on
		 * the dashboard so manual input/sensor controls live in one place only).
		 */
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	let today = $state(getLocalDateString());
	let manualInput = $state('');
	let goalInput = $state('');
	let showSettings = $state(false);
	let feedback = $state('');
	let feedbackError = $state('');

	// Sensor state
	let sensorStatus = $state<SensorStatus>('unsupported');
	let sensorMessage = $state('');
	let sensor = $state<MotionSensor | null>(null);
	let sessionStartSteps = $state(0);
	let sessionAdded = $state(0);

	onMount(() => {
		today = getLocalDateString();
		goalInput = String(stepStore.goal);
		sensorStatus = isMotionSupported() ? 'ready' : 'unsupported';
	});

	onDestroy(() => {
		sensor?.stop();
	});

	const todaySteps = $derived(stepStore.stepsFor(today));
	const progress = $derived(goalProgress(todaySteps, stepStore.goal));
	const remaining = $derived(Math.max(0, stepStore.goal - todaySteps));

	async function saveManual() {
		feedback = '';
		feedbackError = '';
		const value = Number(manualInput);
		if (!Number.isFinite(value) || value < 0) {
			feedbackError = 'Masukkan jumlah langkah yang valid (≥ 0).';
			return;
		}
		const ok = await stepStore.setSteps(today, value, 'manual');
		if (ok) {
			feedback = `Langkah hari ini disimpan: ${Math.round(value).toLocaleString('id-ID')}.`;
			manualInput = '';
		} else {
			feedbackError = stepStore.error ?? 'Gagal menyimpan langkah.';
		}
	}

	async function addManual() {
		feedback = '';
		feedbackError = '';
		const delta = Number(manualInput);
		if (!Number.isFinite(delta) || delta === 0) {
			feedbackError = 'Masukkan jumlah langkah untuk ditambahkan.';
			return;
		}
		const ok = await stepStore.addSteps(today, delta, 'manual');
		if (ok) {
			feedback = `Ditambahkan ${Math.round(delta).toLocaleString('id-ID')} langkah.`;
			manualInput = '';
		} else {
			feedbackError = stepStore.error ?? 'Gagal menambahkan langkah.';
		}
	}

	async function saveGoal() {
		feedback = '';
		feedbackError = '';
		const value = Number(goalInput);
		if (!Number.isFinite(value) || value < 1000) {
			feedbackError = 'Target minimal 1.000 langkah.';
			return;
		}
		const ok = await stepStore.updateGoal(value);
		if (ok) {
			feedback = `Target harian diperbarui: ${stepStore.goal.toLocaleString('id-ID')} langkah.`;
			goalInput = String(stepStore.goal);
		} else {
			feedbackError = stepStore.error ?? 'Gagal menyimpan target.';
		}
	}

	async function toggleSensor() {
		feedback = '';
		feedbackError = '';
		if (sensorStatus === 'active' && sensor) {
			sensor.stop();
			sensor = null;
			await flushSensorSteps();
			return;
		}

		sessionStartSteps = stepStore.stepsFor(today);
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
		const status = await instance.start(sessionStartSteps);
		sensorStatus = status;
	}

	// Persist the accumulated sensor steps for the current session.
	async function flushSensorSteps() {
		if (sessionAdded <= 0) return;
		const target = sessionStartSteps + sessionAdded;
		await stepStore.setSteps(today, target, 'sensor');
		feedback = `Langkah dari sensor disimpan: ${sessionAdded.toLocaleString('id-ID')}.`;
		sessionAdded = 0;
	}

	// Periodically flush while the sensor is running so data isn't lost.
	$effect(() => {
		if (sensorStatus !== 'active') return;
		const interval = setInterval(() => {
			void flushSensorSteps();
			sessionStartSteps = stepStore.stepsFor(today);
		}, 15000);
		return () => clearInterval(interval);
	});

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

<section class="card step-card" aria-labelledby="step-counter-title">
	<div class="spread">
		<div class="step-head">
			<span class="step-icon" aria-hidden="true"><StepIcon /></span>
			<div>
				<h2 id="step-counter-title" class="card-title">Langkah Hari Ini</h2>
				<p class="card-subtitle">
					Target {stepStore.goal.toLocaleString('id-ID')} langkah/hari
					{#if !compact}· sumber: sensor, manual, atau impor{/if}
				</p>
			</div>
		</div>
		{#if !compact}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				onclick={() => (showSettings = !showSettings)}
				aria-expanded={showSettings}
			>
				{showSettings ? 'Tutup pengaturan' : 'Atur target'}
			</button>
		{:else}
			<a class="text-link" href="/steps">Buka halaman Langkah →</a>
		{/if}
	</div>

	{#if !compact}
		<p class="card-link-row">
			<a class="text-link" href="/steps">Buka halaman Langkah →</a>
		</p>
	{/if}

	<div class="step-summary">
		<div class="step-big">
			<span class="step-count">{todaySteps.toLocaleString('id-ID')}</span>
			<span class="step-unit">langkah hari ini</span>
		</div>
		<div class="step-facts">
			<span>{estimateDistanceKm(todaySteps)} km</span>
			<span>≈ {estimateCalories(todaySteps)} kkal</span>
			<span>{remaining > 0 ? `${remaining.toLocaleString('id-ID')} lagi ke target` : 'Target tercapai'}</span>
		</div>
	</div>

	<ProgressBar value={progress} label="Progress target harian" />

	{#if !compact}
		{#if showSettings}
			<div class="step-settings">
				<div class="field">
					<label for="step-goal">Target langkah harian</label>
					<div class="inline-control">
						<input
							id="step-goal"
							type="number"
							min="1000"
							max="100000"
							step="500"
							inputmode="numeric"
							bind:value={goalInput}
						/>
						<button type="button" class="btn btn-secondary" onclick={saveGoal} disabled={stepStore.saving}>
							Simpan target
						</button>
					</div>
				</div>
			</div>
		{/if}

		<div class="step-controls">
			<div class="field grow">
				<label for="step-manual">Input manual (jumlah langkah)</label>
				<div class="inline-control">
					<input
						id="step-manual"
						type="number"
						min="0"
						step="1"
						inputmode="numeric"
						placeholder="misal 3500"
						bind:value={manualInput}
					/>
					<button type="button" class="btn btn-primary" onclick={addManual} disabled={stepStore.saving}>
						+ Tambah
					</button>
					<button type="button" class="btn btn-secondary" onclick={saveManual} disabled={stepStore.saving}>
						Set total
					</button>
				</div>
			</div>

			<div class="sensor-block">
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
					<p class="sensor-message muted">{sensorMessage}</p>
				{:else if sensorStatus === 'unsupported'}
					<p class="sensor-message muted">
						Perangkat/tab ini tidak menyediakan sensor gerakan. Gunakan input manual.
					</p>
				{/if}
			</div>
		</div>

		{#if feedback}
			<p class="alert alert-success" role="status">{feedback}</p>
		{/if}
		{#if feedbackError}
			<p class="alert alert-error" role="alert">{feedbackError}</p>
		{/if}

		<p class="step-disclaimer muted text-sm">
			Perhitungan sensor berbasis akselerometer bersifat perkiraan dan hanya berjalan saat halaman
			ini terbuka. Untuk data akurat, gunakan input manual atau impor dari aplikasi kesehatan Anda.
		</p>
	{/if}
</section>

<style>
	.step-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.step-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		border-radius: var(--radius-md);
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
	}

	.step-summary {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		margin: var(--space-4) 0 var(--space-3);
		flex-wrap: wrap;
	}

	.step-big {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.step-count {
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--color-primary);
		font-variant-numeric: tabular-nums;
	}

	.step-unit {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.step-facts {
		display: flex;
		gap: var(--space-4);
		font-size: 0.85rem;
		color: var(--color-text-muted);
		flex-wrap: wrap;
	}

	.step-settings {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
	}

	.step-controls {
		margin-top: var(--space-4);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.inline-control {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.inline-control input {
		flex: 1;
		min-width: 8rem;
	}

	.grow {
		width: 100%;
	}

	.sensor-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-items: flex-start;
	}

	.sensor-status {
		font-size: 0.85rem;
		color: var(--color-success);
	}

	.sensor-message {
		font-size: 0.85rem;
		max-width: 40rem;
	}

	.step-disclaimer {
		margin-top: var(--space-4);
	}

	.card-link-row {
		margin-top: var(--space-3);
	}

	.text-link {
		color: var(--color-primary);
		font-weight: 600;
		font-size: 0.9rem;
	}
</style>
