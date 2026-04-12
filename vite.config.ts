import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			// Fork compiler for terminal compilation in web worker
			'svelte-fork-compiler': path.resolve('../svelte-fork/packages/svelte/compiler/index.js'),
			// svelterm core for terminal rendering
			'@svelterm/core': path.resolve('../svelterm/src/index.ts'),
			'@svelterm/core/app': path.resolve('../svelterm/src/index.ts'),
		},
	},
});
