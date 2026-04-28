/**
 * Browser preview mode. The iframe owns a v86 factory and a Svelte mount
 * point. On each `mount` message, the previous component is unmounted, the
 * v86 factory is reset, and the new compiled JS is evaluated as a Blob
 * module and mounted.
 */

import { mount, unmount } from 'svelte'
import { rewriteImports, rewriteCssInJs, evaluateBlobModule } from './runtime.js'
import { createV86StreamFactory } from './v86-stream.js'
import EmbeddedTerminalDom from '@svelterm/vt100/EmbeddedTerminalDom'
import { applyTheme } from './theme.js'
import type { ParentMessage } from './protocol.js'
import { postToParent } from './main.js'

export function mountBrowser(root: HTMLElement): (msg: ParentMessage) => void {
    const v86Factory = createV86StreamFactory()

    window.__rt__.embeddedTerminalDom = EmbeddedTerminalDom
    window.__rt__.embeddedTerminalRegion = undefined
    window.__rt__.v86Stream = v86Factory.v86Stream

    let currentApp: any = null
    let styleEl: HTMLStyleElement | null = null

    return async (msg) => {
        if (msg.kind === 'mount') {
            await tearDown()
            try {
                if (msg.css) {
                    styleEl = document.createElement('style')
                    styleEl.textContent = msg.css
                    document.head.appendChild(styleEl)
                }
                const code = rewriteCssInJs(rewriteImports(msg.code))
                const mod = await evaluateBlobModule(code)
                if (!mod.default) throw new Error('No default export found')
                currentApp = mount(mod.default, { target: root })
            } catch (e: any) {
                postToParent({ kind: 'error', message: e.message ?? String(e) })
            }
        } else if (msg.kind === 'theme') {
            applyTheme(msg.mode)
        } else if (msg.kind === 'destroy') {
            await tearDown()
        }
    }

    async function tearDown() {
        if (currentApp) {
            try { await unmount(currentApp) } catch {}
            currentApp = null
        }
        if (styleEl) {
            styleEl.remove()
            styleEl = null
        }
        // Svelte's append_styles() injects scoped CSS into the document head
        // keyed by hash, and never removes it on unmount. Without this sweep,
        // each remount accumulates another <style> element and the head grows
        // unboundedly as the user types.
        for (const el of document.head.querySelectorAll('style[id^="svelte-"]')) {
            el.remove()
        }
        v86Factory.destroy()
        root.innerHTML = ''
    }
}
