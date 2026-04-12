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

	// Layout state
	let splitRatio = $state(0.45); // editor takes 45% of width
	let playgroundHeight = $state(600);
	let zoom = $state(1);
	let container: HTMLElement;
	let previewWidth = $state(0);
	let previewHeight = $state(0);
	let browserPanel: HTMLElement;
	let browserScreen: HTMLElement;
	let termCols = $state(0);
	let termRows = $state(0);
	let dragging = $state<'split' | 'height' | null>(null);

	$effect(() => {
		const src = editableCode;
		if (!src) return;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			compileAndUpdate(src);
		}, 500);
	});

	onMount(() => {
		updatePreviewDimensions();
		const observer = new ResizeObserver(() => updatePreviewDimensions());
		observer.observe(container);
		if (browserScreen) observer.observe(browserScreen);
		return () => observer.disconnect();
	});

	function updatePreviewDimensions() {
		if (!container) return;
		previewWidth = container.clientWidth * (1 - splitRatio) - 9;
		if (browserScreen?.parentElement) {
			// Use the panel's content area height (excluding header).
			// The preview-screen is scaled by CSS transform, so its clientHeight
			// is clamped by flex layout. The parent panel's height minus the header
			// gives the actual pixel area, and the template divides by zoom.
			const header = browserScreen.parentElement.querySelector('.panel-header');
			const headerH = header ? header.clientHeight : 0;
			previewHeight = browserScreen.parentElement.clientHeight - headerH;
		}
	}

	async function compileAndUpdate(src: string) {
		if (!src.trim()) return;
		try {
			const result = await compileComponent(src);
			if (result.terminal) {
				terminalJs = result.terminal.js;
				terminalCss = result.terminal.css;
			}
		} catch {}
	}

	function startDragSplit(e: PointerEvent) {
		dragging = 'split';
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function startDragHeight(e: PointerEvent) {
		dragging = 'height';
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || !container) return;
		if (dragging === 'split') {
			const rect = container.getBoundingClientRect();
			splitRatio = Math.max(0.25, Math.min(0.65, (e.clientX - rect.left) / rect.width));
			updatePreviewDimensions();
		} else if (dragging === 'height') {
			const rect = container.getBoundingClientRect();
			playgroundHeight = Math.max(300, Math.min(900, e.clientY - rect.top));
		}
	}

	function onPointerUp() {
		dragging = null;
	}

	$effect(() => {
		splitRatio; zoom; playgroundHeight;
		// Use tick to ensure DOM has updated before measuring
		requestAnimationFrame(() => updatePreviewDimensions());
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="playground"
	bind:this={container}
	style="height: {playgroundHeight}px; grid-template-columns: {splitRatio}fr {1 - splitRatio}fr;"
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
>
	<div class="editor">
		<div class="panel-header">Component</div>
		<div class="editor-body">
			<CodeEditor bind:code={editableCode} />
		</div>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="divider-v" style="left: calc({splitRatio * 100}% - 3px);" onpointerdown={startDragSplit}></div>

	<div class="previews">
		<div class="preview-panel">
			<div class="panel-header">
				Terminal
				{#if termCols > 0}
					<span class="size-indicator">{termCols} × {termRows} cells</span>
				{/if}
			</div>
			<div class="preview-screen" style="transform: scale({zoom}); transform-origin: top left; width: {100/zoom}%; height: {100/zoom}%;">
				<TerminalPreview {terminalJs} {terminalCss} {zoom} onResize={(c, r) => { termCols = c; termRows = r; }} />
			</div>
		</div>

		<div class="preview-panel" bind:this={browserPanel}>
			<div class="panel-header">
				Browser
				{#if previewWidth > 0}
					<span class="size-indicator">{Math.floor(previewWidth / zoom)} × {Math.floor(previewHeight / zoom)}px</span>
				{/if}
			</div>
			<div class="preview-screen" bind:this={browserScreen} style="transform: scale({zoom}); transform-origin: top left; width: {100/zoom}%; height: {100/zoom}%;">
				<BrowserPreview source={editableCode} />
			</div>
		</div>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="divider-h" onpointerdown={startDragHeight}></div>
</div>

<div class="controls">
	<label>
		Zoom
		<input type="range" min="0.5" max="2" step="0.05" bind:value={zoom} />
		<span>{Math.round(zoom * 100)}%</span>
	</label>
</div>

<style>
	.playground {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		background: #222;
		border: 1px solid #333;
		border-radius: 8px;
		overflow: hidden;
		position: relative;
		user-select: none;
	}

	.editor {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		border-right: 1px solid #333;
	}

	.editor-body {
		flex: 1;
		min-height: 0;
		background: #0d1117;
	}

	.previews {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
	}

	.preview-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.preview-panel + .preview-panel {
		border-top: 1px solid #333;
	}

	.preview-screen {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: #0d1117;
	}

	.panel-header {
		padding: 0.4rem 0.75rem;
		background: #1a1a2e;
		color: #888;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-shrink: 0;
	}

	.size-indicator {
		font-size: 0.65rem;
		color: #aaa;
		font-variant-numeric: tabular-nums;
	}

	.divider-v {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: col-resize;
		z-index: 10;
		background: #333;
		transition: background 0.15s;
	}

	.divider-v::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 2px;
		width: 4px;
		height: 32px;
		transform: translateY(-50%);
		border-left: 1px solid #555;
		border-right: 1px solid #555;
	}

	.divider-h {
		position: absolute;
		left: 0;
		right: 0;
		height: 8px;
		bottom: -4px;
		cursor: row-resize;
		z-index: 10;
		background: #333;
		border-radius: 0 0 8px 8px;
		transition: background 0.15s;
	}

	.divider-h::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 2px;
		width: 32px;
		height: 4px;
		transform: translateX(-50%);
		border-top: 1px solid #555;
		border-bottom: 1px solid #555;
	}

	.divider-v:hover, .divider-h:hover {
		background: #48cae4;
	}

	.controls {
		display: flex;
		justify-content: flex-end;
		padding: 0.5rem 0;
		gap: 1rem;
	}

	.controls label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #888;
		font-size: 0.8rem;
	}

	.controls input[type="range"] {
		width: 100px;
		accent-color: #48cae4;
	}

	.controls span {
		width: 3em;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
