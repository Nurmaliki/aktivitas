<script lang="ts">
	interface Props {
		/** Reserved for future per-icon tweaks; kept for API stability. */
		size?: number;
		/** Inner SVG markup. MUST be a trusted literal from `navigation.ts`. */
		paths: string;
	}

	let { size = 24, paths }: Props = $props();
</script>

<!--
  Icon paths come exclusively from the hard-coded `NAV_LINKS` constant in
  `$lib/navigation.ts` — never from user input — so `{@html}` is safe here.
-->
<svg
	class="nav-icon"
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
	.nav-icon {
		display: block;
		flex-shrink: 0;
	}
</style>
