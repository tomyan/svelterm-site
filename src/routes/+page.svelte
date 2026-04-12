<script>
	import Playground from '$lib/Playground.svelte';
	import Section from '$lib/Section.svelte';
	import ThemeToggle from '$lib/ThemeToggle.svelte';
	import { examples } from '$lib/examples/index.js';
</script>

<svelte:head>
	<title>SvelTERM — Svelte for the terminal</title>
</svelte:head>

<main>
	<header>
		<div class="header-row">
			<div class="header-spacer"></div>
			<h1 class="brand">SvelTERM</h1>
			<div class="header-links">
				<a href="https://tomyandell.dev" title="Tom Yandell" class="header-icon">
					<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
						<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
					</svg>
				</a>
				<a href="https://www.npmjs.com/package/@svelterm/core" title="npm" class="header-icon">
					<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
						<path d="M3 3h18v18H3V3zm2.25 2.25v13.5h4.5v-11.25h3.375v11.25h1.125V5.25H5.25z"/>
					</svg>
				</a>
				<a href="https://github.com/tomyan/svelterm" title="GitHub" class="header-icon">
					<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
						<path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.84 9.49.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85 0 1.7.11 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .26.18.58.69.48A10 10 0 0 0 22 12c0-5.523-4.477-10-10-10z"/>
					</svg>
				</a>
				<ThemeToggle />
			</div>
		</div>
		<p class="tagline">Standard Svelte. Real HTML+CSS. Terminal and/or browser from the same source.</p>
	</header>

	<Playground {examples} />

	<Section title="Terminal CSS">
		<p>Things that are different in the terminal:</p>
		<ul>
			<li><strong>Borders</strong> — <code>single</code>, <code>double</code>, <code>rounded</code>, <code>heavy</code> using box-drawing characters</li>
			<li><strong>Units</strong> — <code>cell</code> maps to terminal cells (monospace character positions)</li>
			<li><strong>Colors</strong> — ANSI names (<code>cyan</code>), truecolor (<code>#ff6b6b</code>), all 148 CSS named colors</li>
			<li><strong>Opacity</strong> — <code>opacity: dim</code> uses the terminal dim attribute</li>
			<li><strong>Focus</strong> — <code>:focus</code> and <code>:hover</code> pseudo-classes work via keyboard and mouse</li>
			<li><strong>Media queries</strong> — <code>@media (display-mode: terminal)</code> and <code>@media (display-mode: browser)</code> for target-specific rules</li>
		</ul>
		<p>
			Terminal-specific values like <code>border: rounded</code> and <code>1cell</code> are
			naturally ignored by browsers — they're invalid CSS. Everything else is standard:
			flexbox, variables, media queries, calc(), selectors, specificity, cascade.
		</p>
	</Section>

	<Section title="Why?">
		<div class="reasons">
			<div class="reason">
				<h3>LLMs know CSS</h3>
				<p>
					Every frontier model has been trained on CSS and Svelte. An AI generating
					SvelTERM components is writing standard code, no novel APIs to learn.
				</p>
			</div>
			<div class="reason">
				<h3>Svelte solved the hard problems</h3>
				<p>
					Reactivity, scoped CSS, compilation, editor tooling, HMR, all inherited.
					SvelTERM adds a renderer and a CSS engine.
				</p>
			</div>
			<div class="reason">
				<h3>No framework has a CSS engine</h3>
				<p>
					Ink uses JSX props. Bubble Tea is imperative. Ratatui is Rust structs.
					They all reinvent styling. SvelTERM uses CSS.
				</p>
			</div>
		</div>
	</Section>

	<Section title="Status">
		<p>
			SvelTERM is early stage. It builds on Paolo Ricciuti's
			<a href="https://github.com/sveltejs/svelte/pull/18058">custom renderer API</a> for
			Svelte, which is experimental and not yet merged. A prototype SvelteKit integration
			works, with terminal apps getting HMR, routing, and the full SvelteKit dev
			experience, but depends on an open
			<a href="https://github.com/sveltejs/vite-plugin-svelte/pull/1318">vite-plugin-svelte PR</a> landing.
		</p>
		<p>
			Feedback on the terminal rendering is very much appreciated.
			<a href="https://github.com/tomyan/svelterm/issues">Open an issue</a> or get in touch.
		</p>
	</Section>
</main>

<style>
	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-spacer { width: 140px; }

	.header-links {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.header-icon {
		color: var(--color-text-muted);
		padding: 0.35rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: color 0.15s;
		text-decoration: none;
	}

	.header-icon:hover {
		color: var(--color-text);
		text-decoration: none;
	}

	h1.brand {
		font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
		font-size: 3rem;
		font-weight: 400;
		letter-spacing: 0.02em;
		margin: 0;
	}

	.tagline {
		font-size: 1.25rem;
		color: var(--color-text-muted);
		margin-top: 0.5rem;
	}

	.reasons {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		margin-top: 1rem;
	}

	.reason {
		padding: 1.5rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
	}

	.reason h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.1rem;
	}

	.reason p {
		margin: 0;
		color: var(--color-text-light);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	code {
		background: var(--color-bg-secondary);
		padding: 0.15em 0.4em;
		border-radius: 3px;
		font-size: 0.9em;
	}

	ul {
		padding-left: 1.5rem;
	}

	li {
		margin-bottom: 0.5rem;
	}
</style>
