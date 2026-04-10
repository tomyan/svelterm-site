<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView, keymap } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { svelte } from '@replit/codemirror-lang-svelte';
	import { defaultKeymap, indentWithTab } from '@codemirror/commands';
	import { basicSetup } from 'codemirror';

	let { code = $bindable(), readonly = false } = $props();
	let container: HTMLDivElement;
	let view: EditorView;

	onMount(() => {
		view = new EditorView({
			state: EditorState.create({
				doc: code,
				extensions: [
					basicSetup,
					svelte(),
					oneDark,
					keymap.of([...defaultKeymap, indentWithTab]),
					EditorView.editable.of(!readonly),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							code = update.state.doc.toString();
						}
					}),
					EditorView.theme({
						'&': {
							height: '100%',
							fontSize: '0.85rem',
						},
						'.cm-scroller': {
							fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
							lineHeight: '1.5',
						},
						'.cm-gutters': {
							background: '#0d1117',
							borderRight: '1px solid #222',
						},
					}),
				],
			}),
			parent: container,
		});

		return () => view.destroy();
	});
</script>

<div class="editor-container" bind:this={container}></div>

<style>
	.editor-container {
		height: 100%;
		overflow: hidden;
	}

	.editor-container :global(.cm-editor) {
		height: 100%;
	}
</style>
