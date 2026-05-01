/**
 * Iframe entry. Boots in untrusted origin (svelterm-untrusted.* in prod,
 * svelterm-untrusted.localhost:5174 / 127.0.0.1:5174 in dev). Validates
 * postMessages by origin against a hardcoded allow-list, then dispatches
 * to the browser or terminal mount handler.
 */

// Cell font: JetBrains Mono (with its built-in ligatures) for code/text,
// Pure Nerd Font as a glyph-only fallback so any nerd-font icon glyph the
// embedded shell emits also renders. Both ship as `'self'` woff2 — Vite
// bundles them through these CSS imports — so the iframe's strict
// `font-src 'self'` CSP is satisfied without changes.
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import '@azurity/pure-nerd-font/pure-nerd-font.css'

import type { ParentMessage, IframeMessage } from './protocol.js'
import { mountBrowser } from './browser-mode.js'
import { mountTerminal } from './terminal-mode.js'

const ALLOWED_PARENT_ORIGINS = new Set([
    'http://localhost:5173',
    'http://svelterm.localhost:5173',
    'https://svelterm.dev',
])

let parentOrigin: string | null = null

export function postToParent(message: IframeMessage): void {
    if (!parentOrigin) return
    window.parent.postMessage(message, parentOrigin)
}

let handler: ((message: ParentMessage) => void) | null = null

window.addEventListener('message', (event) => {
    if (!ALLOWED_PARENT_ORIGINS.has(event.origin)) return
    parentOrigin = event.origin

    const message = event.data as ParentMessage
    if (!message || typeof message !== 'object') return

    if (message.kind === 'init') {
        handler = message.mode === 'terminal'
            ? mountTerminal(document.getElementById('root')!)
            : mountBrowser(document.getElementById('root')!)
        postToParent({ kind: 'ready' })
        return
    }

    handler?.(message)
})
