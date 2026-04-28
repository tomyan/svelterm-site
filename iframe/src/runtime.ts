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
 *
 * Also rewrites `@media (prefers-color-scheme: light|dark)` so its rules
 * apply when the iframe has `<html data-theme="...">` set, matching the
 * parent's theme toggle. In a cross-origin iframe `prefers-color-scheme`
 * is bound to OS settings, so we duplicate each rule under a
 * `:root[data-theme="..."]` selector that the iframe can drive directly.
 */
export function rewriteCssInJs(js: string): string {
    return js.replace(/(code:\s*')([\s\S]*?)(')/g, (_match, pre, css, post) => {
        let result = css as string
        result = result.replace(/@media\s*\(display-mode:\s*browser\)\s*\{((?:[^{}]|\{[^{}]*\})*)\s*\}/g, '$1')
        result = result.replace(/@media\s*\(display-mode:\s*terminal\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
        result = rewritePrefersColorScheme(result)
        return pre + result + post
    })
}

/**
 * For each `@media (prefers-color-scheme: X) { ...rules... }` block, also
 * emit a copy where each rule's selector is scoped under `[data-theme="X"]`
 * — this lets the iframe drive theme via attribute (parent toggle) while
 * still falling through to the OS preference when no `data-theme` is set.
 *
 * Handles single-quote escaping of the resulting CSS so it remains valid
 * inside the surrounding `code: '...'` string literal.
 */
function rewritePrefersColorScheme(css: string): string {
    return css.replace(
        /@media\s*\(prefers-color-scheme:\s*(light|dark)\)\s*\{((?:[^{}]|\{[^{}]*\})*)\s*\}/g,
        (match, scheme, body) => {
            // The CSS lives inside a JS string literal in the compiled module.
            // Newlines in the source are encoded as the two-character sequence
            // `\n`; inserting a real newline here would unterminate the string
            // and produce a syntax error at evaluateBlobModule time.
            const scoped = scopeSelectorsWithDataTheme(body, scheme)
            return match + '\\n' + scoped
        },
    )
}

function scopeSelectorsWithDataTheme(body: string, scheme: string): string {
    return body.replace(/([^{}]+)\{([^{}]*)\}/g, (_m, selectorList: string, decls: string) => {
        const scoped = selectorList
            .split(',')
            .map((s) => {
                const trimmed = s.trim()
                if (!trimmed) return ''
                if (trimmed === ':root' || trimmed.startsWith(':root ')) {
                    return trimmed.replace(/^:root/, `:root[data-theme="${scheme}"]`)
                }
                return `[data-theme="${scheme}"] ${trimmed}`
            })
            .filter(Boolean)
            .join(', ')
        return `${scoped} {${decls}}`
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
