<script lang="ts">
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/theme.svelte.js';

	let { children } = $props();

	onMount(() => initTheme());
</script>

{@render children()}

<style>
	:global(:root) {
		/* Dark theme (default) */
		--color-bg: #0d1117;
		--color-bg-secondary: #1a1a2e;
		--color-bg-tertiary: #222;
		--color-text: #e6edf3;
		--color-text-muted: #888;
		--color-text-light: #aaa;
		--color-accent: #48cae4;
		--color-accent-warm: #fbbf24;
		--color-link: #58a6ff;
		--color-border: #333;
		--color-border-medium: #555;
		--color-error: #ff6b6b;
		--color-error-bg: #1a0000;
		color-scheme: dark;
	}

	:global(:root[data-theme="light"]) {
		--color-bg: #ffffff;
		--color-bg-secondary: #f0f0f8;
		--color-bg-tertiary: #e8e8ee;
		--color-text: #1a1a2e;
		--color-text-muted: #666;
		--color-text-light: #555;
		--color-accent: #0891b2;
		--color-accent-warm: #d97706;
		--color-link: #0969da;
		--color-border: #d0d7de;
		--color-border-medium: #999;
		--color-error: #cf222e;
		--color-error-bg: #fff1f0;
		color-scheme: light;
	}

	@media (prefers-color-scheme: light) {
		:global(:root:not([data-theme])) {
			--color-bg: #ffffff;
			--color-bg-secondary: #f0f0f8;
			--color-bg-tertiary: #e8e8ee;
			--color-text: #1a1a2e;
			--color-text-muted: #666;
			--color-text-light: #555;
			--color-accent: #0891b2;
			--color-accent-warm: #d97706;
			--color-link: #0969da;
			--color-border: #d0d7de;
			--color-border-medium: #999;
			--color-error: #cf222e;
			--color-error-bg: #fff1f0;
			--syn-tag: #22863a;
			--syn-attribute: #6f42c1;
			--syn-string: #032f62;
			--syn-keyword: #d73a49;
			--syn-variable: #e36209;
			--syn-comment: #6a737d;
			--syn-number: #005cc5;
			--syn-property: #005cc5;
			--syn-punctuation: #24292e;
			--syn-operator: #d73a49;
			color-scheme: light;
		}
	}

	:global(body) {
		margin: 0;
		background: var(--color-bg);
		color: var(--color-text);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		line-height: 1.6;
	}

	:global(a) {
		color: var(--color-link);
		text-decoration: none;
	}

	:global(a:hover) {
		text-decoration: underline;
	}
</style>
