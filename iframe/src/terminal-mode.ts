/**
 * Terminal preview mode. Mounts TerminalShell to render a vt100 grid into
 * the iframe DOM, then on each `mount` message runs the user's compiled
 * component through svelterm's `run()` with an InProcessIO whose output
 * feeds the displayed Terminal.
 */

import { mount } from 'svelte'
import { run, InProcessIO } from '@svelterm/core/app'
import TerminalShell from './TerminalShell.svelte'
import { rewriteImports, evaluateBlobModule } from './runtime.js'
import { createV86StreamFactory } from './v86-stream.js'
import { applyTheme, resolveScheme } from './theme.js'
import type { ParentMessage, ThemeMode } from './protocol.js'
import { postToParent } from './main.js'

function termColors(scheme: 'dark' | 'light') {
    return scheme === 'light'
        ? { foreground: '#1a1a2e', background: '#ffffff' }
        : { foreground: '#c9d1d9', background: '#0d1117' }
}

export function mountTerminal(root: HTMLElement): (msg: ParentMessage) => void {
    const v86Factory = createV86StreamFactory()
    window.__rt__.v86Stream = v86Factory.v86Stream
    window.__rt__.embeddedTerminalDom = undefined

    let shellHandle: import('./TerminalShell.svelte').ShellHandle | null = null
    let cols = 40
    let rows = 15
    let currentIO: InProcessIO | null = null
    let currentCleanup: (() => void) | null = null
    let regionLoaded = false
    let themeMode: ThemeMode = 'auto'
    let appliedScheme: 'dark' | 'light' = resolveScheme(themeMode)
    let lastMount: { code: string; css: string; regionCode?: string } | null = null

    const colors = termColors(appliedScheme)

    mount(TerminalShell, {
        target: root,
        props: {
            initialForeground: colors.foreground,
            initialBackground: colors.background,
            onSize: (c: number, r: number) => {
                cols = c
                rows = r
                if (currentIO) currentIO.setSize(c, r)
                postToParent({ kind: 'size', cols: c, rows: r })
            },
            onMouseInput: (data: string) => {
                // Mouse stays on the svelterm path. Routing it to the
                // input sink would pump SGR mouse sequences at the
                // embedded shell on every pixel of mouse movement —
                // and a vanilla busybox prompt that hasn't enabled
                // mouse mode (`\x1b[?1000h`) just types those bytes
                // at the cursor as garbage. Once we want vi-with-mouse
                // inside v86 we'll parse the guest's mode-enable
                // sequence and gate this on it.
                if (currentIO) currentIO.feedInput(data)
            },
            onKeyInput: (data: string) => {
                // If an EmbeddedTerminalRegion (or other in-app terminal
                // component) has registered an input sink, forward typed
                // bytes there directly — that lets the user drive the
                // embedded shell without keys being intercepted by the
                // svelterm focus manager wrapping this preview.
                const sink = (globalThis as any).__svtTerminalInputSink
                if (typeof sink === 'function') {
                    sink(data)
                } else if (currentIO) {
                    currentIO.feedInput(data)
                }
            },
            onReady: (handle) => {
                shellHandle = handle
            },
        },
    })

    async function applyMount(payload: { code: string; css: string; regionCode?: string }) {
        tearDown()
        const terminal = shellHandle?.getTerminal()
        try {
            if (payload.regionCode && !regionLoaded) {
                const regionMod = await evaluateBlobModule(payload.regionCode)
                window.__rt__.embeddedTerminalRegion = regionMod.default
                regionLoaded = true
            }
            if (!terminal) throw new Error('Terminal not yet initialized')
            terminal.write('\x1b[2J\x1b[H')
            const code = rewriteImports(payload.code)
            const mod = await evaluateBlobModule(code)
            if (!mod.default) throw new Error('No default export found')

            const io = new InProcessIO(cols, rows)
            io.onOutput = (data: string) => terminal.write(data)
            currentIO = io
            appliedScheme = resolveScheme(themeMode)
            currentCleanup = run(mod.default, {
                css: payload.css,
                fullscreen: false,
                mouse: true,
                io,
                colorScheme: appliedScheme,
            })
            terminal.write('\x1b[?25l')
        } catch (e: any) {
            postToParent({ kind: 'error', message: e.message ?? String(e) })
        }
    }

    return async (msg) => {
        if (msg.kind === 'mount') {
            lastMount = { code: msg.code, css: msg.css, regionCode: msg.regionCode }
            await applyMount(lastMount)
        } else if (msg.kind === 'theme') {
            themeMode = msg.mode
            applyTheme(msg.mode)
            const scheme = resolveScheme(themeMode)
            const c = termColors(scheme)
            shellHandle?.setColors(c.foreground, c.background)
            // Only replay the user's mount if the resolved scheme actually
            // changed — otherwise the initial 'auto' theme message from the
            // parent would tear down a fresh mount (and any v86 emulator
            // booting inside) before its first frame rendered.
            if (lastMount && scheme !== appliedScheme) {
                await applyMount(lastMount)
            }
        } else if (msg.kind === 'destroy') {
            tearDown()
        }
    }

    function tearDown() {
        if (currentCleanup) {
            try { currentCleanup() } catch {}
            currentCleanup = null
        }
        currentIO = null
        v86Factory.destroy()
    }
}
