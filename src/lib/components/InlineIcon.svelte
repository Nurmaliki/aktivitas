<script lang="ts">
	/**
	 * Small inline icon meant to sit inside running text (e.g. a streak badge).
	 * Sizes via the `size` prop and inherits `currentColor`. Paths are trusted
	 * literals — never user input.
	 */
	type IconName = 'flame' | 'check' | 'target';

	interface Props {
		name: IconName;
		size?: number;
	}

	let { name, size = 16 }: Props = $props();

	const ICONS: Record<IconName, string> = {
		flame:
			'<path d="M12 3.5c.6 2.2-.4 3.3-1.4 4.3C9.2 9.2 8 10.6 8 13a4 4 0 0 0 8 0c0-1.3-.5-2.2-1-3-.3.6-.9 1-1.5 1 .6-2.2 0-5.3-1.5-7.5Z" />',
		check: '<path d="M5 12.5l4.5 4.5L19 7" />',
		target:
			'<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" />'
	};

	const paths = $derived(ICONS[name]);
</script>

<svg
	class="inline-icon"
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="1.9"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{@html paths}
</svg>

<style>
	.inline-icon {
		display: inline-block;
		vertical-align: -0.18em;
	}
</style>
