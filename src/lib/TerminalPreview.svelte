<script lang="ts">
    import { onMount } from 'svelte';
    import { Terminal } from '@svelterm/vt100';
    import { TerminalRenderer } from '@svelterm/vt100/dom';
    import { theme } from './theme.svelte.js';

    let {
        terminalJs = '',
        terminalCss = '',
        zoom = 1,
        onResize = undefined as ((cols: number, rows: number) => void) | undefined,
    }: {
        terminalJs?: string
        terminalCss?: string
        zoom?: number
        onResize?: (cols: number, rows: number) => void
    } = $props()

    let cols = 40
    let rows = 15
    let computedFontSize = 13
    let computedCharWidth = 0
    const fontFamily = "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace"

    let container: HTMLElement
    let terminal: Terminal
    let renderer: TerminalRenderer
    let cleanup: (() => void) | null = null
    let currentIO: any = null
    let sveltermRuntime: any = $state(null)


    function isLight(): boolean {
        return theme.mode === 'light' || (theme.mode === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches)
    }

    function termColors() {
        return isLight()
            ? { foreground: '#1a1a2e', background: '#ffffff' }
            : { foreground: '#c9d1d9', background: '#0d1117' }
    }

    function recalculateSize() {
        if (!container || !terminal || !renderer || !computedCharWidth) return
        // The preview-screen has width:{100/zoom}% and transform:scale(zoom).
        // Width: the percentage resolves correctly (cross-axis in column flex),
        //   so clientWidth reflects the content viewport.
        // Width changes with zoom (fewer cols at higher zoom).
        // Height: rows stay fixed — the terminal scrolls vertically.
        const newWidth = container.clientWidth - 8
        const newCols = Math.max(10, Math.floor(newWidth / computedCharWidth))
        const newHeight = container.clientHeight - 8
        const newRows = Math.max(5, Math.floor(newHeight / lineHeight))
        // Visible rows in the viewport (fewer at higher zoom)
        const visibleRows = Math.max(1, Math.floor(newHeight / (lineHeight * zoom)))
        if (newCols !== cols || newRows !== rows) {
            cols = newCols
            rows = newRows
            terminal.resize(cols, rows)
            if (currentIO) {
                currentIO.setSize(cols, rows)
            }
            const colors = termColors()
            renderer.dispose()
            renderer = new TerminalRenderer(container, terminal, {
                fontSize: computedFontSize,
                lineHeight: 1.3,
                foreground: colors.foreground,
                background: colors.background,
                fontFamily,
            })
            renderer.render()
        }
        onResize?.(newCols, visibleRows)
    }

    onMount(() => {
        // Calculate optimal columns and font size to fill the container width
        const containerWidth = container.clientWidth - 8 // minus padding
        // fontFamily is defined at module level
        const minFontSize = 11
        const maxFontSize = 16
        const targetFontSize = 13

        // Measure character width at target font size
        function measureCharWidth(fontSize: number): number {
            const span = document.createElement('span')
            span.style.fontFamily = fontFamily
            span.style.fontSize = `${fontSize}px`
            span.style.position = 'absolute'
            span.style.visibility = 'hidden'
            span.style.whiteSpace = 'pre'
            span.textContent = 'M'
            document.body.appendChild(span)
            const w = span.getBoundingClientRect().width
            document.body.removeChild(span)
            return w
        }

        // Start with target font size, calculate columns
        let fontSize = targetFontSize
        let charW = measureCharWidth(fontSize)
        cols = Math.floor(containerWidth / charW)

        // Fine-tune font size to fill width more exactly
        const targetWidth = containerWidth
        const currentWidth = cols * charW
        const ratio = targetWidth / currentWidth
        fontSize = Math.min(maxFontSize, Math.max(minFontSize, fontSize * ratio))
        charW = measureCharWidth(fontSize)

        // Recalculate cols with adjusted font size
        cols = Math.floor(containerWidth / charW)
        computedFontSize = fontSize
        lineHeight = fontSize * 1.3

        computedCharWidth = charW

        const initColors = termColors()
        terminal = new Terminal(cols, rows)
        terminal.backgroundColor = initColors.background
        terminal.onResponse = (data: string) => {
            if (currentIO) currentIO.feedInput(data)
        }
        renderer = new TerminalRenderer(container, terminal, {
            fontSize,
            lineHeight: 1.3,
            foreground: initColors.foreground,
            background: initColors.background,
            fontFamily,
        })

        onResize?.(cols, rows)

        // Watch for container resize and update terminal cols
        const resizeObserver = new ResizeObserver(() => recalculateSize())
        resizeObserver.observe(container)

        // Load svelterm and svelte fork runtime via .js file
        // to avoid svelte/internal import ban in .svelte files
        loadRuntime()

        return () => {
            resizeObserver.disconnect()
            if (cleanup) cleanup()
            renderer.dispose()
        }
    })

    async function loadRuntime() {
        try {
            const runtime = await import('./svelterm-runtime.js')
            sveltermRuntime = {
                run: runtime.run,
                InProcessIO: runtime.InProcessIO,
            }

            ;(window as any).__svelterm_terminal_modules__ = {
                internal: runtime.svelteInternal,
                renderer: { default: runtime.sveltermRenderer },
            }
        } catch (e) {
            console.error('Failed to load svelterm runtime:', e)
        }
    }

    $effect(() => {
        // Recalculate terminal size when zoom changes
        const z = zoom
        if (!container || !terminal || !renderer) return
        recalculateSize()
    })


    $effect(() => {
        // Update terminal colors when theme changes — affects both the OSC 11
        // response (for svelterm's prefers-color-scheme) and the visual rendering
        const m = theme.mode
        if (!terminal || !renderer || !container) return
        const colors = termColors()
        terminal.backgroundColor = colors.background
        renderer.dispose()
        renderer = new TerminalRenderer(container, terminal, {
            fontSize: computedFontSize,
            lineHeight: 1.3,
            foreground: colors.foreground,
            background: colors.background,
            fontFamily,
        })
        renderer.render()
    })

    $effect(() => {
        if (!sveltermRuntime || !terminal || !renderer) return
        const js = terminalJs
        const css = terminalCss
        if (!js) return

        mountTerminalComponent(js, css)
    })

    async function mountTerminalComponent(js: string, css: string) {
        // Unmount previous
        if (cleanup) {
            try { cleanup() } catch {}
            cleanup = null
        }

        // Clear terminal
        terminal.write('\x1b[2J\x1b[H')

        try {
            // Rewrite imports in the compiled JS
            let code = js
            // Strip side-effect imports
            code = code.replace(/^import\s+['"]svelte[^'"]*['"];?\s*$/gm, '')
            code = code.replace(/^import\s+['"]\@svelterm[^'"]*['"];?\s*$/gm, '')
            // Rewrite: import * as $ from 'svelte/internal/client' → const $ = __internal__
            code = code.replace(/import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]svelte[^'"]*['"]/g,
                'const $1 = __internal__')
            // Rewrite: import { x } from 'svelte/...' → const { x } = __internal__
            code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]svelte\/[^'"]*['"]/g,
                'const {$1} = __internal__')
            code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]svelte['"]/g,
                'const {$1} = __internal__')
            // Rewrite: import $renderer from '@svelterm/core' → const $renderer = __renderer__.default
            code = code.replace(/import\s+([\w$]+)\s+from\s+['"]\@svelterm\/core['"]/g,
                'const $1 = __renderer__.default')

            // Wrap with runtime references
            const moduleCode = [
                'const __internal__ = window.__svelterm_terminal_modules__.internal;',
                'const __renderer__ = window.__svelterm_terminal_modules__.renderer;',
                code,
            ].join('\n')

            // Create blob module and import it
            const blob = new Blob([moduleCode], { type: 'text/javascript' })
            const url = URL.createObjectURL(blob)
            const mod = await import(/* @vite-ignore */ url)
            URL.revokeObjectURL(url)

            const Component = mod.default
            if (!Component) {
                terminal.write('\x1b[31mNo default export found\x1b[0m\r\n')
                renderer.render()
                return
            }

            // Run svelterm with InProcessIO connected to the VT100 terminal
            const { run, InProcessIO } = sveltermRuntime
            const io = new InProcessIO(cols, rows)
            io.onOutput = (data: string) => {
                terminal.write(data)
                renderer.scheduleRender()
            }
            currentIO = io

            cleanup = run(Component, {
                css,
                fullscreen: false,
                mouse: true,
                io,
            })

            // Hide cursor — svelterm does this in fullscreen mode but we
            // don't use fullscreen in the browser-embedded terminal
            terminal.write('\x1b[?25l')
            renderer.render()
        } catch (e: any) {
            terminal.write(`\x1b[31mError: ${e.message}\x1b[0m\r\n`)
            renderer.render()
            console.error('Terminal mount error:', e)
        }
    }

    function measureChar() {
        const span = document.createElement('span')
        span.style.fontFamily = "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace"
        span.style.fontSize = '13px'
        span.style.position = 'absolute'
        span.style.visibility = 'hidden'
        span.style.whiteSpace = 'pre'
        span.textContent = 'M'
        document.body.appendChild(span)
        const w = span.getBoundingClientRect().width
        document.body.removeChild(span)
        return w
    }

    let charWidth = 0
    let lineHeight = 13 * 1.3

    function pixelToCell(clientX: number, clientY: number): { col: number; row: number } {
        if (!charWidth) charWidth = measureChar()
        const rect = container.getBoundingClientRect()
        return {
            col: Math.max(0, Math.min(cols - 1, Math.floor((clientX - rect.left - 4) / charWidth))),
            row: Math.max(0, Math.min(rows - 1, Math.floor((clientY - rect.top - 4) / lineHeight))),
        }
    }

    function handleMouseMove(e: globalThis.MouseEvent) {
        if (!currentIO) return
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        // Motion with button 32+0 (no button), or 35 for no button
        const button = e.buttons ? 32 : 35
        currentIO.feedInput(`\x1b[<${button};${col + 1};${row + 1}M`)
    }

    function handleMouseDown(e: globalThis.MouseEvent) {
        if (!currentIO) return
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        currentIO.feedInput(`\x1b[<${e.button === 0 ? 0 : 2};${col + 1};${row + 1}M`)
    }

    function handleMouseUp(e: globalThis.MouseEvent) {
        if (!currentIO) return
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        currentIO.feedInput(`\x1b[<${e.button === 0 ? 0 : 2};${col + 1};${row + 1}m`)
    }

    let scrollAccumY = 0
    let scrollAccumX = 0

    function handleWheel(e: WheelEvent) {
        if (!currentIO) return
        e.preventDefault()
        const { col, row } = pixelToCell(e.clientX, e.clientY)

        // Shift+wheel or horizontal trackpad = horizontal scroll
        const isHorizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
        const delta = isHorizontal ? (e.shiftKey ? e.deltaY : e.deltaX) : e.deltaY

        if (isHorizontal) {
            scrollAccumX += delta / charWidth
            const cols = Math.trunc(scrollAccumX)
            if (cols !== 0) {
                scrollAccumX -= cols
                // Shift modifier = bit 2 (4) on scroll codes
                const button = cols < 0 ? (64 | 4) : (65 | 4)
                const count = Math.min(Math.abs(cols), 5)
                for (let i = 0; i < count; i++) {
                    currentIO.feedInput(`\x1b[<${button};${col + 1};${row + 1}M`)
                }
            }
        } else {
            scrollAccumY += delta / lineHeight
            const lines = Math.trunc(scrollAccumY)
            if (lines !== 0) {
                scrollAccumY -= lines
                const button = lines < 0 ? 64 : 65
                const count = Math.min(Math.abs(lines), 5)
                for (let i = 0; i < count; i++) {
                    currentIO.feedInput(`\x1b[<${button};${col + 1};${row + 1}M`)
                }
            }
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!currentIO) return
        e.preventDefault()
        let seq: string | null = null
        if (e.ctrlKey && e.key.length === 1) {
            const code = e.key.toLowerCase().charCodeAt(0) - 0x60
            if (code >= 1 && code <= 26) seq = String.fromCharCode(code)
        }
        if (!seq) {
            switch (e.key) {
                case 'Enter': seq = '\r'; break
                case 'Backspace': seq = '\x7f'; break
                case 'Tab': seq = e.shiftKey ? '\x1b[Z' : '\t'; break
                case 'Escape': seq = '\x1b'; break
                case 'ArrowUp': seq = '\x1b[A'; break
                case 'ArrowDown': seq = '\x1b[B'; break
                case 'ArrowRight': seq = '\x1b[C'; break
                case 'ArrowLeft': seq = '\x1b[D'; break
                case 'Delete': seq = '\x1b[3~'; break
            }
        }
        if (!seq && e.key.length === 1 && !e.ctrlKey && !e.metaKey) seq = e.key
        if (seq) currentIO.feedInput(seq)
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    class="terminal-container"
    bind:this={container}
    tabindex="0"
    role="application"
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
    onmousemove={handleMouseMove}
    onwheel={handleWheel}
    onkeydown={handleKeyDown}
></div>

<style>
    .terminal-container {
        width: 100%;
        height: 100%;
        padding: 4px;
        box-sizing: border-box;
        outline: none;
        cursor: text;
    }
</style>
