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
import { applyTheme } from './theme.js'
import type { ParentMessage, ThemeMode } from './protocol.js'
import { postToParent } from './main.js'

function isLight(mode: ThemeMode): boolean {
    if (mode === 'light') return true
    if (mode === 'dark') return false
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
}

function termColors(mode: ThemeMode) {
    return isLight(mode)
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

    const colors = termColors(themeMode)

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
                if (currentIO) currentIO.feedInput(data)
            },
            onKeyInput: (data: string) => {
                if (currentIO) currentIO.feedInput(data)
            },
            onReady: (handle) => {
                shellHandle = handle
            },
        },
    })

    return async (msg) => {
        if (msg.kind === 'mount') {
            tearDown()
            const terminal = shellHandle?.getTerminal()
            try {
                if (msg.regionCode && !regionLoaded) {
                    const regionMod = await evaluateBlobModule(msg.regionCode)
                    window.__rt__.embeddedTerminalRegion = regionMod.default
                    regionLoaded = true
                }
                if (!terminal) throw new Error('Terminal not yet initialized')
                terminal.write('\x1b[2J\x1b[H')
                const code = rewriteImports(msg.code)
                const mod = await evaluateBlobModule(code)
                if (!mod.default) throw new Error('No default export found')

                const io = new InProcessIO(cols, rows)
                io.onOutput = (data: string) => terminal.write(data)
                currentIO = io
                currentCleanup = run(mod.default, {
                    css: msg.css,
                    fullscreen: false,
                    mouse: true,
                    io,
                })
                terminal.write('\x1b[?25l')
            } catch (e: any) {
                postToParent({ kind: 'error', message: e.message ?? String(e) })
            }
        } else if (msg.kind === 'theme') {
            themeMode = msg.mode
            applyTheme(msg.mode)
            const c = termColors(msg.mode)
            shellHandle?.setColors(c.foreground, c.background)
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
