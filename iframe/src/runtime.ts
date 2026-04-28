/**
 * Bundled runtime modules exposed to user-component blob URLs via
 * `window.__rt__`. The compiled user code's bare imports (e.g.
 * `import { onDestroy } from 'svelte'`) are rewritten by `rewriteImports`
 * to read from this object. This keeps the rewriter simple and avoids
 * import-map complexity inside Blob modules.
 */

import * as svelte from 'svelte'
import * as svelteInternal from 'svelte/internal/client'
import * as sveltermCore from '@svelterm/core'
import * as vt100 from '@svelterm/vt100'

declare global {
    interface Window {
        __rt__: {
            svelte: typeof svelte
            svelteInternal: typeof svelteInternal
            sveltermCore: typeof sveltermCore
            vt100: typeof vt100
            // Mode-dependent slots, populated by the active mount handler.
            embeddedTerminalDom?: unknown
            embeddedTerminalRegion?: unknown
            v86Stream?: (...args: any[]) => any
        }
    }
}

window.__rt__ = {
    svelte,
    svelteInternal,
    sveltermCore,
    vt100,
}

export function rewriteImports(code: string): string {
    let out = code
    out = out.replace(/^import\s+['"]svelte[^'"]*['"];?\s*$/gm, '')
    out = out.replace(/^import\s+['"]\@svelterm\/core['"];?\s*$/gm, '')
    out = out.replace(
        /import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]svelte[^'"]*['"]/g,
        'const $1 = window.__rt__.svelteInternal',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]svelte\/[^'"]*['"]/g,
        'const {$1} = window.__rt__.svelteInternal',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]svelte['"]/g,
        'const {$1} = window.__rt__.svelte',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]\@svelterm\/core['"]/g,
        'const {$1} = window.__rt__.sveltermCore',
    )
    out = out.replace(
        /import\s+([\w$]+)\s+from\s+['"]\@svelterm\/core['"]/g,
        'const $1 = window.__rt__.sveltermCore.default',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]v86-stream['"]/g,
        'const {$1} = { v86Stream: window.__rt__.v86Stream }',
    )
    out = out.replace(
        /import\(\s*['"]\@svelterm\/vt100\/EmbeddedTerminalDom['"]\s*\)/g,
        'Promise.resolve({ default: window.__rt__.embeddedTerminalDom }).then(m => { if (!m.default) throw new Error("EmbeddedTerminalDom is not available in this preview"); return m })',
    )
    out = out.replace(
        /import\(\s*['"]\@svelterm\/vt100\/EmbeddedTerminalRegion['"]\s*\)/g,
        'Promise.resolve({ default: window.__rt__.embeddedTerminalRegion }).then(m => { if (!m.default) throw new Error("EmbeddedTerminalRegion is not available in this preview"); return m })',
    )
    return out
}

/**
 * The browser compile uses `css: 'injected'`, so the component's CSS is
 * embedded inside the JS as a `code: '...'` string. User code wraps
 * browser-only rules in `@media (display-mode: browser)` (which only
 * matches inside a PWA, not in our iframe) and terminal-only rules in
 * `@media (display-mode: terminal)` (which contains terminal-specific
 * syntax browsers can't parse). Unwrap the first and strip the second.
 */
export function rewriteCssInJs(js: string): string {
    return js.replace(/(code:\s*')([\s\S]*?)(')/g, (_match, pre, css, post) => {
        let result = css as string
        result = result.replace(/@media\s*\(display-mode:\s*browser\)\s*\{((?:[^{}]|\{[^{}]*\})*)\s*\}/g, '$1')
        result = result.replace(/@media\s*\(display-mode:\s*terminal\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
        return pre + result + post
    })
}

export async function evaluateBlobModule(code: string): Promise<any> {
    const blob = new Blob([code], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    try {
        return await import(/* @vite-ignore */ url)
    } finally {
        URL.revokeObjectURL(url)
    }
}
