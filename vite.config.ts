import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Deploy target: Vercel. See https://svelte.dev/docs/kit/adapter-vercel
			// We pin an explicit runtime so the build works regardless of the local
			// Node version (Vercel uses this runtime for serverless functions too).
			adapter: adapter({ runtime: 'nodejs22.x' })
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'node'
	}
});
