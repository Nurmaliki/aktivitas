<script lang="ts">
	interface Props {
		size?: number;
	}

	let { size = 22 }: Props = $props();
</script>

<!-- Footprints icon (inline SVG, no external asset). -->
<svg
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
	<path d="M7.5 3.2c1.1 0 1.9.9 1.9 2.5 0 1.3-.2 2.3-.2 3.3 0 1-.6 1.7-1.6 1.7s-1.7-.7-1.8-1.7c-.1-1-.3-2-.4-3.3-.1-1.6.8-2.5 2.1-2.5Z" />
	<path d="M5.4 13.4c.9-.5 2-.6 3-.2 1.1.4 1.9 1.2 2.3 2.2.4 1 .2 2-.4 2.6-.7.7-1.8.9-2.9.5-1-.4-1.8-1.2-2.1-2.2-.3-.9-.3-1.9.1-2.9Z" />
	<path d="M16.5 3.2c1.1 0 1.9.9 1.9 2.5 0 1.3-.2 2.3-.2 3.3 0 1-.6 1.7-1.6 1.7s-1.7-.7-1.8-1.7c-.1-1-.3-2-.4-3.3-.1-1.6.8-2.5 2.1-2.5Z" />
	<path d="M14.4 13.4c.9-.5 2-.6 3-.2 1.1.4 1.9 1.2 2.3 2.2.4 1 .2 2-.4 2.6-.7.7-1.8.9-2.9.5-1-.4-1.8-1.2-2.1-2.2-.3-.9-.3-1.9.1-2.9Z" />
</svg>

<style>
	svg {
		display: block;
	}
</style>
