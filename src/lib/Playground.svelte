<script lang="ts">
	import CodeEditor from './CodeEditor.svelte';
	import TerminalPreview from './TerminalPreview.svelte';
	import BrowserPreview from './BrowserPreview.svelte';
	import { compileComponent } from './compiler.js';
	import { onMount } from 'svelte';

	import type { Example } from './examples/index.js';
	let { examples }: { examples: Example[] } = $props();
	let activeIndex = $state(0);
	let editedCodes: (string | null)[] = $state(examples.map(() => null));
	let editableCode = $state(examples[0].code);
	let sidebarOpen = $state(false);

	function isModified(index: number): boolean {
		return editedCodes[index] !== null && editedCodes[index] !== examples[index].code;
	}

	function resetExample(index: number) {
		editedCodes[index] = null;
		if (index === activeIndex) {
			editableCode = examples[index].code;
		}
	}
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
		// Track edits per example
		editedCodes[activeIndex] = src;
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

	function selectExample(index: number) {
		// Save current edits
		editedCodes[activeIndex] = editableCode;
		// Switch
		activeIndex = index;
		editableCode = editedCodes[index] ?? examples[index].code;
		sidebarOpen = false;
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
		<div class="panel-header">
			<button class="sidebar-toggle" onclick={() => sidebarOpen = !sidebarOpen} title="Examples">
				<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
					<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
				</svg>
			</button>
			<span class="example-name">{examples[activeIndex].name}{#if isModified(activeIndex)}<span class="modified">*</span>{/if}</span>
		</div>
		<div class="editor-area">
			{#if sidebarOpen}
				<div class="sidebar">
					<div class="sidebar-label">Examples</div>
					{#each examples as example, i}
						<div class="sidebar-item" class:active={i === activeIndex}>
							<button class="sidebar-item-name" onclick={() => selectExample(i)}>
								{example.name}{#if isModified(i)}<span class="modified">*</span>{/if}
							</button>
							{#if isModified(i)}
								<button class="sidebar-reset" onclick={() => resetExample(i)} title="Reset to original">
									<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
										<path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 1 1 .908-.418A6 6 0 1 1 8 2v1z"/>
										<path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966a.25.25 0 0 1 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
									</svg>
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
			<div class="editor-body">
				<CodeEditor bind:code={editableCode} />
			</div>
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
		background: var(--color-bg-tertiary);
		border: 1px solid var(--color-border);
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
		border-right: 1px solid var(--color-border);
	}

	.editor-area {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.editor-body {
		flex: 1;
		min-height: 0;
		min-width: 0;
		background: var(--color-bg);
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
		border-top: 1px solid var(--color-border);
	}

	.preview-screen {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--color-bg);
	}

	.panel-header {
		padding: 0.4rem 0.75rem;
		background: var(--color-bg-secondary);
		color: var(--color-text-muted);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-shrink: 0;
	}

	.sidebar-toggle {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.15rem;
		display: flex;
		align-items: center;
		border-radius: 3px;
		transition: color 0.15s;
	}

	.sidebar-toggle:hover {
		color: var(--color-text);
	}

	.example-name {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.sidebar {
		width: 140px;
		flex-shrink: 0;
		background: var(--color-bg-secondary);
		border-right: 1px solid var(--color-border);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		padding: 0.25rem 0;
	}

	.sidebar-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
		padding: 0.4rem 0.75rem 0.2rem;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		transition: background 0.1s;
	}

	.sidebar-item:hover {
		background: var(--color-bg-tertiary);
	}

	.sidebar-item.active {
		background: var(--color-bg-tertiary);
	}

	.sidebar-item-name {
		flex: 1;
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 0.8rem;
		padding: 0.4rem 0.75rem;
		cursor: pointer;
		text-align: left;
		text-transform: capitalize;
		transition: color 0.1s;
	}

	.sidebar-item:hover .sidebar-item-name {
		color: var(--color-text);
	}

	.sidebar-item.active .sidebar-item-name {
		color: var(--color-accent);
	}

	.modified {
		color: var(--color-accent-warm);
		margin-left: 0.15em;
	}

	.sidebar-reset {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		display: flex;
		align-items: center;
		opacity: 0.6;
		transition: opacity 0.1s, color 0.1s;
	}

	.sidebar-reset:hover {
		opacity: 1;
		color: var(--color-accent);
	}

	.size-indicator {
		font-size: 0.65rem;
		color: var(--color-text-light);
		font-variant-numeric: tabular-nums;
	}

	.divider-v {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: col-resize;
		z-index: 10;
		background: var(--color-border);
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
		border-left: 1px solid var(--color-border-medium);
		border-right: 1px solid var(--color-border-medium);
	}

	.divider-h {
		position: absolute;
		left: 0;
		right: 0;
		height: 8px;
		bottom: -4px;
		cursor: row-resize;
		z-index: 10;
		background: var(--color-border);
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
		border-top: 1px solid var(--color-border-medium);
		border-bottom: 1px solid var(--color-border-medium);
	}

	.divider-v:hover, .divider-h:hover {
		background: var(--color-accent);
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
		color: var(--color-text-muted);
		font-size: 0.8rem;
	}

	.controls input[type="range"] {
		width: 100px;
		accent-color: var(--color-accent);
	}

	.controls span {
		width: 3em;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
