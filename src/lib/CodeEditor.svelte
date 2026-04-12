<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView, keymap } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { tags } from '@lezer/highlight';
	import { svelte } from '@replit/codemirror-lang-svelte';
	import { defaultKeymap, indentWithTab } from '@codemirror/commands';
	import { basicSetup } from 'codemirror';
	import { theme } from './theme.svelte.js';

	let { code = $bindable(), readonly = false } = $props();
	let container: HTMLDivElement;
	let view: EditorView;

	const darkHighlight = HighlightStyle.define([
		{ tag: tags.keyword, color: '#c678dd' },
		{ tag: tags.operator, color: '#56b6c2' },
		{ tag: tags.string, color: '#98c379' },
		{ tag: tags.number, color: '#d19a66' },
		{ tag: tags.bool, color: '#d19a66' },
		{ tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
		{ tag: tags.variableName, color: '#e06c75' },
		{ tag: tags.definition(tags.variableName), color: '#e5c07b' },
		{ tag: tags.propertyName, color: '#61afef' },
		{ tag: tags.tagName, color: '#e06c75' },
		{ tag: tags.attributeName, color: '#d19a66' },
		{ tag: tags.attributeValue, color: '#98c379' },
		{ tag: tags.typeName, color: '#e5c07b' },
		{ tag: tags.className, color: '#e5c07b' },
		{ tag: tags.function(tags.variableName), color: '#61afef' },
		{ tag: tags.punctuation, color: '#abb2bf' },
		{ tag: tags.bracket, color: '#abb2bf' },
	])

	const lightHighlight = HighlightStyle.define([
		{ tag: tags.keyword, color: '#a626a4' },
		{ tag: tags.operator, color: '#0184bc' },
		{ tag: tags.string, color: '#50a14f' },
		{ tag: tags.number, color: '#986801' },
		{ tag: tags.bool, color: '#986801' },
		{ tag: tags.comment, color: '#8a8a8a', fontStyle: 'italic' },
		{ tag: tags.variableName, color: '#c0392b' },
		{ tag: tags.definition(tags.variableName), color: '#c18401' },
		{ tag: tags.propertyName, color: '#2b6cb0' },
		{ tag: tags.tagName, color: '#c0392b' },
		{ tag: tags.attributeName, color: '#986801' },
		{ tag: tags.attributeValue, color: '#50a14f' },
		{ tag: tags.typeName, color: '#c18401' },
		{ tag: tags.className, color: '#c18401' },
		{ tag: tags.function(tags.variableName), color: '#2b6cb0' },
		{ tag: tags.punctuation, color: '#555' },
		{ tag: tags.bracket, color: '#555' },
	])

	function isLight(): boolean {
		if (theme.mode === 'dark') return false
		if (theme.mode === 'light') return true
		return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
	}

	function buildExtensions(light: boolean) {
		return [
			basicSetup,
			svelte(),
			syntaxHighlighting(light ? lightHighlight : darkHighlight),
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
			}),
		]
	}

	onMount(() => {
		view = new EditorView({
			state: EditorState.create({
				doc: code,
				extensions: buildExtensions(isLight()),
			}),
			parent: container,
		});

		return () => view.destroy();
	});

	$effect(() => {
		const light = isLight()
		if (!view) return
		const doc = view.state.doc.toString()
		view.setState(EditorState.create({
			doc,
			extensions: buildExtensions(light),
		}))
	})
</script>

<div class="editor-container" bind:this={container}></div>

<style>
	.editor-container {
		height: 100%;
		overflow: hidden;
	}

	.editor-container :global(.cm-editor) {
		height: 100%;
		background: var(--color-bg);
	}

	.editor-container :global(.cm-gutters) {
		background: var(--color-bg-secondary) !important;
		border-right: 1px solid var(--color-bg-tertiary) !important;
		color: var(--color-text-muted) !important;
	}

	.editor-container :global(.cm-content) {
		caret-color: var(--color-text);
	}

	.editor-container :global(.cm-activeLine) {
		background: var(--color-bg-tertiary) !important;
	}

	.editor-container :global(.cm-activeLineGutter) {
		background: var(--color-bg-tertiary) !important;
	}

	.editor-container :global(.cm-cursor) {
		border-left-color: var(--color-text) !important;
	}

	.editor-container :global(.cm-selectionBackground) {
		background: color-mix(in srgb, var(--color-accent) 25%, transparent) !important;
	}
</style>
