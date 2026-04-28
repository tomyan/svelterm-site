/**
 * Iframe entry. Boots in untrusted origin (svelterm-untrusted.* in prod,
 * svelterm-untrusted.localhost:5174 / 127.0.0.1:5174 in dev). Validates
 * postMessages by origin against a hardcoded allow-list, then dispatches
 * to the browser or terminal mount handler.
 */

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
