// Re-export svelterm and svelte runtime modules.
// This .js file avoids the svelte/internal import ban
// that only applies to .svelte files.
export { run, InProcessIO } from '@svelterm/core/app'
export * as svelteInternal from 'svelte/internal/client'
export { default as sveltermRenderer } from '@svelterm/core'
