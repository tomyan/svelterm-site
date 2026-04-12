<script lang="ts">
	import CodeEditor from './CodeEditor.svelte';
	import TerminalPreview from './TerminalPreview.svelte';
	import BrowserPreview from './BrowserPreview.svelte';
	import { compileComponent } from './compiler.js';
	import { onMount } from 'svelte';

	let { code } = $props();
	let editableCode = $state(code);
	let terminalJs = $state('');
	let terminalCss = $state('');
	let debounceTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		const src = editableCode;
		console.error('[playground] $effect fired, src length:', src?.length ?? 0);
		if (!src) return;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			compileAndUpdate(src);
		}, 500);
	});

	async function compileAndUpdate(src: string) {
		if (!src.trim()) return;
		// Debug marker
		if (typeof window !== 'undefined') {
			(window as any).__playgroundCompiled = (window as any).__playgroundCompiled || [];
		}
		try {
			const result = await compileComponent(src);
			if (typeof window !== 'undefined') {
				(window as any).__playgroundCompiled.push({
					hasBrowser: !!result.browser,
					hasTerminal: !!result.terminal,
					terminalError: (result as any).terminalError,
					error: result.error,
				});
			}
			console.log('[playground] compile result:', {
				hasBrowser: !!result.browser,
				hasTerminal: !!result.terminal,
				terminalError: (result as any).terminalError,
				error: result.error,
			});
			if (result.terminal) {
				terminalJs = result.terminal.js;
				terminalCss = result.terminal.css;
			}
		} catch {}
	}
</script>

<div class="playground">
	<div class="editor">
		<div class="panel-header">Component</div>
		<div class="editor-body">
			<CodeEditor bind:code={editableCode} />
		</div>
	</div>
	<div class="terminal">
		<div class="panel-header">Terminal</div>
		<div class="terminal-screen">
			<TerminalPreview cols={40} rows={15} {terminalJs} {terminalCss} />
		</div>
	</div>
	<div class="web">
		<div class="panel-header">Browser</div>
		<div class="web-screen">
			<BrowserPreview source={editableCode} />
		</div>
	</div>
</div>

<style>
	.playground {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		background: #333;
		border: 1px solid #333;
		border-radius: 8px;
		overflow: hidden;
		height: 70vh;
		max-height: 600px;
	}

	.editor {
		grid-row: 1 / 3;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.editor-body {
		flex: 1;
		min-height: 0;
		background: #0d1117;
	}

	.terminal, .web {
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		padding: 0.5rem 1rem;
		background: #1a1a2e;
		color: #888;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.terminal-screen {
		flex: 1;
		background: #0d1117;
		min-height: 0;
		overflow: hidden;
	}

	.web-screen {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
</style>
