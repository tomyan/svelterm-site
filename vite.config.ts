import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: [
			// Fork compiler for terminal compilation in web worker
			{ find: 'svelte-fork-compiler', replacement: path.resolve('../svelte-fork/packages/svelte/compiler/index.js') },
			// svelterm app — run(), InProcessIO, etc.
			{ find: '@svelterm/core/app', replacement: path.resolve('../svelterm/src/index.ts') },
			// svelterm renderer (default export for compiled components)
			{ find: '@svelterm/core', replacement: path.resolve('../svelterm/src/renderer/default.ts') },
		],
	},
});
