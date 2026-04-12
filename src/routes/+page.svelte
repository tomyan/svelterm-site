<script>
	import Playground from '$lib/Playground.svelte';
	import Section from '$lib/Section.svelte';

	const defaultExample = `<script>
    let count = $state(0)
<\/script>

<style>
    .counter {
        display: flex;
        flex-direction: column;
        color: #e8e8e8;
    }

    .title { color: #48cae4; font-weight: bold; }
    .value { color: #fbbf24; font-weight: bold; }

    button {
        color: #e8e8e8;
        border-color: #555;
    }

    button:focus {
        border-color: #fbbf24;
        color: #fbbf24;
        font-weight: bold;
    }

    button:hover {
        border-color: #48cae4;
        color: #48cae4;
    }

    @media (display-mode: browser) {
        .counter {
            gap: 0.75rem;
            padding: 1.5rem;
            font-family: system-ui, sans-serif;
            border: 2px solid #48cae4;
            border-radius: 8px;
        }

        button {
            border: 1px solid #555;
            border-radius: 4px;
            padding: 0.4rem 1.2rem;
            cursor: pointer;
            font-size: inherit;
        }

    }

    @media (display-mode: terminal) {
        .counter {
            gap: 1cell;
            padding: 1cell;
            border: rounded;
            border-color: #48cae4;
        }

        button {
            border: single;
            padding: 0 2cell;
        }
    }
</style>

<div class="counter">
    <span class="title">Counter</span>
    <span class="value">{count}</span>
    <button onclick={() => count++}>Increment</button>
    <button onclick={() => count--}>Decrement</button>
</div>`;
</script>

<svelte:head>
	<title>Svelterm — Svelte for the terminal</title>
</svelte:head>

<main>
	<header>
		<h1>svelterm</h1>
		<p class="tagline">Standard Svelte. Real CSS. Terminal and browser.</p>
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
			<li><strong>Media queries</strong> — <code>@media (display-mode: terminal)</code> and <code>@media (display-mode: screen)</code> for target-specific rules</li>
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
					svelterm components is writing standard code — no novel APIs to learn.
				</p>
			</div>
			<div class="reason">
				<h3>Svelte solved the hard problems</h3>
				<p>
					Reactivity, scoped CSS, compilation, editor tooling, HMR — all inherited.
					Svelterm adds a renderer and a CSS engine.
				</p>
			</div>
			<div class="reason">
				<h3>No framework has a CSS engine</h3>
				<p>
					Ink uses JSX props. Bubble Tea is imperative. Ratatui is Rust structs.
					They all reinvent styling. Svelterm uses CSS.
				</p>
			</div>
		</div>
	</Section>
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 3rem;
	}

	h1 {
		font-size: 3rem;
		font-weight: 300;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.tagline {
		font-size: 1.25rem;
		color: #888;
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
		border: 1px solid #333;
		border-radius: 8px;
	}

	.reason h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.1rem;
	}

	.reason p {
		margin: 0;
		color: #aaa;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	code {
		background: #1a1a2e;
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
