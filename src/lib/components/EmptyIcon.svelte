<script lang="ts">
	/**
	 * Empty-state icon: replaces ad-hoc emoji with a consistent inline SVG that
	 * matches the navigation icon style (24x24, 1.9 stroke, currentColor).
	 *
	 * Every path is a hard-coded literal — never user input — so there is no
	 * injection risk and no external asset to load.
	 */
	type IconName = 'activity' | 'habit' | 'chart' | 'check' | 'steps';

	interface Props {
		name: IconName;
		size?: number;
	}

	let { name, size = 30 }: Props = $props();

	const ICONS: Record<IconName, string> = {
		// Pencil / note (activities, history).
		activity:
			'<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M13.5 6.5l3 3" />',
		// Leaf / sprout (habits).
		habit:
			'<path d="M12 20.5c0-4 .5-7 3-10" /><path d="M15 10.5c.3-3 2-5 5-5.5.5 3-1 5.3-5 5.5Z" /><path d="M11.5 15.5c-3-.5-4.8-2.3-5-5.5 3 .3 4.6 2 5 5.5Z" />',
		// Bar chart (statistics).
		chart:
			'<rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M8 16v-3.5M12 16V8M16 16v-5.5" />',
		// Check in a circle (success / done).
		check:
			'<circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.4l2.4 2.4 4.6-5" />',
		// Footprints (steps).
		steps:
			'<path d="M7.5 3.2c1.1 0 1.9.9 1.9 2.5 0 1.3-.2 2.3-.2 3.3 0 1-.6 1.7-1.6 1.7s-1.7-.7-1.8-1.7c-.1-1-.3-2-.4-3.3-.1-1.6.8-2.5 2.1-2.5Z" /><path d="M5.4 13.4c.9-.5 2-.6 3-.2 1.1.4 1.9 1.2 2.3 2.2.4 1 .2 2-.4 2.6-.7.7-1.8.9-2.9.5-1-.4-1.8-1.2-2.1-2.2-.3-.9-.3-1.9.1-2.9Z" /><path d="M16.5 3.2c1.1 0 1.9.9 1.9 2.5 0 1.3-.2 2.3-.2 3.3 0 1-.6 1.7-1.6 1.7s-1.7-.7-1.8-1.7c-.1-1-.3-2-.4-3.3-.1-1.6.8-2.5 2.1-2.5Z" /><path d="M14.4 13.4c.9-.5 2-.6 3-.2 1.1.4 1.9 1.2 2.3 2.2.4 1 .2 2-.4 2.6-.7.7-1.8.9-2.9.5-1-.4-1.8-1.2-2.1-2.2-.3-.9-.3-1.9.1-2.9Z" />'
	};

	const paths = $derived(ICONS[name]);
</script>

<span class="empty-icon" aria-hidden="true">
	<svg
		viewBox="0 0 24 24"
		width={size}
		height={size}
		fill="none"
		stroke="currentColor"
		stroke-width="1.9"
		stroke-linecap="round"
		stroke-linejoin="round"
		focusable="false"
	>
		{@html paths}
	</svg>
</span>

<style>
	.empty-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 4rem;
		height: 4rem;
		border-radius: var(--radius-lg);
		background-color: var(--color-primary-soft);
		color: var(--color-primary);
	}

	svg {
		display: block;
	}
</style>
