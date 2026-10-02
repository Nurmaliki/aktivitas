<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import AlarmScreen from '$lib/components/AlarmScreen.svelte';
	import NetworkStatus from '$lib/components/NetworkStatus.svelte';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { stepStore } from '$lib/stores/steps.svelte.js';
	import { reminderStore } from '$lib/stores/reminder.svelte.js';
	import { habitStore } from '$lib/stores/habit.svelte.js';
	import { networkStore } from '$lib/stores/network.svelte.js';
	import { syncStore } from '$lib/stores/sync.svelte.js';

	let { children } = $props();

	// Kick off the initial IndexedDB loads once, on the client. `onMount` runs a
	// single time (unlike `$effect`, which re-runs whenever any reactive state it
	// reads changes) so the cleanup fires exactly once on teardown.
	onMount(() => {
		activityStore.init();
		stepStore.init();
		habitStore.init();
		reminderStore.start();
		networkStore.init();
		syncStore.init();
		return () => {
			reminderStore.stop();
			networkStore.destroy();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
	<meta name="theme-color" content="#f8fafc" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="Daily Activity" />
</svelte:head>

<div class="app-shell">
	<Navbar />
	<NetworkStatus />
	<main>
		{@render children()}
	</main>
</div>

<AlarmScreen />
