// Re-export svelterm and svelte runtime modules.
// This .js file avoids the svelte/internal import ban
// that only applies to .svelte files.
export { run, InProcessIO } from '@svelterm/core/app'
export * as svelteInternal from 'svelte/internal/client'
export * as sveltermCore from '@svelterm/core'
export * as sveltermVt100 from '@svelterm/vt100'
export { createV86StreamFactory } from './v86-stream.js'
export { loadEmbeddedTerminalRegion } from './embedded-terminal-region-loader.js'
