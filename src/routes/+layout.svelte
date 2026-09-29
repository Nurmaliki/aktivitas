<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import AlarmScreen from '$lib/components/AlarmScreen.svelte';
	import { activityStore } from '$lib/stores/activity.svelte.js';
	import { stepStore } from '$lib/stores/steps.svelte.js';
	import { reminderStore } from '$lib/stores/reminder.svelte.js';

	let { children } = $props();

	// Kick off the initial IndexedDB loads once, on the client.
	$effect(() => {
		activityStore.init();
		stepStore.init();
		reminderStore.start();
		return () => reminderStore.stop();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-shell">
	<Navbar />
	<main>
		{@render children()}
	</main>
</div>

<AlarmScreen />
