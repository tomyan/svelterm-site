<script>
	import Playground from '$lib/Playground.svelte';
	import Section from '$lib/Section.svelte';
	import ThemeToggle from '$lib/ThemeToggle.svelte';

	const defaultExample = `<script>
    let count = $state(0)
<\/script>

<div class="counter">
    <span class="title">Counter</span>
    <span class="value">{count}</span>
    <button onclick={() => count++}>Increment</button>
    <button onclick={() => count--}>Decrement</button>
</div>

<style>
    :root {
        --text: #e8e8e8;
        --accent: #48cae4;
        --accent-warm: #fbbf24;
        --btn-border: #555;
    }

    @media (prefers-color-scheme: light) {
        :root {
            --text: #1a1a2e;
            --accent: #0891b2;
            --accent-warm: #d97706;
            --btn-border: #999;
        }
    }

    .counter {
        display: flex;
        flex-direction: column;
        color: var(--text);

        @media (display-mode: browser) {
            gap: 0.75rem;
            padding: 1.5rem;
            font-family: system-ui, sans-serif;
            border: 2px solid var(--accent);
            border-radius: 8px;
        }

        @media (display-mode: terminal) {
            margin: 0 1cell;
            gap: 1cell;
            padding: 1cell 2cell 0 2cell;
            border: rounded;
            border-color: var(--accent);
        }
    }

    .title { color: var(--accent); font-weight: bold; }
    .value { color: var(--accent-warm); font-weight: bold; }

    button {
        color: var(--text);
        border-color: var(--btn-border);

        @media (display-mode: browser) {
            border: 1px solid var(--btn-border);
            border-radius: 4px;
            padding: 0.4rem 1.2rem;
            cursor: pointer;
            font-size: inherit;
        }

        @media (display-mode: terminal) {
            border: single;
            padding: 0 2cell;
        }
    }

    button:focus {
        border-color: var(--accent-warm);
        color: var(--accent-warm);
        font-weight: bold;
    }

    button:hover {
        border-color: var(--accent);
        color: var(--accent);
    }
</style>`;
</script>

<svelte:head>
	<title>SvelTERM — Svelte for the terminal</title>
</svelte:head>

<main>
	<header>
		<div class="header-row">
			<div></div>
			<h1 class="brand">SvelTERM</h1>
			<ThemeToggle />
		</div>
		<p class="tagline">Standard Svelte. Real HTML+CSS. Terminal and/or browser from the same source.</p>
	</header>

	<Playground code={defaultExample} />

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

	.header-row > div { width: 36px; }

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
