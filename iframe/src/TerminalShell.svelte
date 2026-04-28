<script lang="ts">
    import { onMount } from 'svelte'
    import { Terminal } from '@svelterm/vt100'
    import TerminalView from '@svelterm/vt100/svelte'

    export interface ShellHandle {
        setColors(foreground: string, background: string): void
        getTerminal(): Terminal | null
    }

    let {
        initialForeground = '#c9d1d9',
        initialBackground = '#0d1117',
        onSize = (_cols: number, _rows: number) => {},
        onMouseInput = (_data: string) => {},
        onKeyInput = (_data: string) => {},
        onReady = (_handle: ShellHandle) => {},
    } = $props<{
        initialForeground?: string
        initialBackground?: string
        onSize?: (cols: number, rows: number) => void
        onMouseInput?: (data: string) => void
        onKeyInput?: (data: string) => void
        onReady?: (handle: ShellHandle) => void
    }>()

    let foreground = $state(initialForeground)
    let background = $state(initialBackground)

    const fontFamily = "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace"
    let computedFontSize = $state(13)
    let charWidth = 0
    let lineHeight = 13
    let cols = 40
    let rows = 15
    let container: HTMLElement
    let terminal = $state.raw<Terminal | null>(null)

    function measureChar(fontSize: number): number {
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

    function recalculate() {
        if (!container || !terminal || !charWidth) return
        const w = container.clientWidth
        const h = container.clientHeight
        if (h <= 0) return
        const newCols = Math.max(10, Math.floor(w / charWidth))
        const newRows = Math.max(5, Math.floor(h / lineHeight))
        if (newCols !== cols || newRows !== rows) {
            cols = newCols
            rows = newRows
            terminal.resize(cols, rows)
            onSize(cols, rows)
        }
    }

    onMount(() => {
        const containerWidth = container.clientWidth
        const containerHeight = container.clientHeight

        const minFontSize = 11
        const maxFontSize = 16
        const targetFontSize = 13

        let fontSize = targetFontSize
        let charW = measureChar(fontSize)
        cols = Math.floor(containerWidth / charW)

        const ratio = containerWidth / (cols * charW)
        fontSize = Math.min(maxFontSize, Math.max(minFontSize, fontSize * ratio))
        fontSize = Math.round(fontSize)
        charW = measureChar(fontSize)
        cols = Math.floor(containerWidth / charW)
        computedFontSize = fontSize
        lineHeight = fontSize * 1.0
        charWidth = charW

        if (containerHeight > 0) {
            rows = Math.max(5, Math.floor(containerHeight / lineHeight))
        }

        const t = new Terminal(cols, rows)
        t.backgroundColor = background
        t.onResponse = (data: string) => onKeyInput(data)
        terminal = t
        onReady({
            setColors(fg, bg) {
                foreground = fg
                background = bg
                if (terminal) terminal.backgroundColor = bg
            },
            getTerminal: () => terminal,
        })
        onSize(cols, rows)

        const ro = new ResizeObserver(() => recalculate())
        ro.observe(container)
        requestAnimationFrame(() => recalculate())

        return () => {
            ro.disconnect()
        }
    })

    function pixelToCell(clientX: number, clientY: number) {
        const rect = container.getBoundingClientRect()
        return {
            col: Math.max(0, Math.min(cols - 1, Math.floor((clientX - rect.left) / charWidth))),
            row: Math.max(0, Math.min(rows - 1, Math.floor((clientY - rect.top) / lineHeight))),
        }
    }

    function handleMouseDown(e: globalThis.MouseEvent) {
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        onMouseInput(`\x1b[<${e.button === 0 ? 0 : 2};${col + 1};${row + 1}M`)
    }
    function handleMouseUp(e: globalThis.MouseEvent) {
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        onMouseInput(`\x1b[<${e.button === 0 ? 0 : 2};${col + 1};${row + 1}m`)
    }
    function handleMouseMove(e: globalThis.MouseEvent) {
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        const button = e.buttons ? 32 : 35
        onMouseInput(`\x1b[<${button};${col + 1};${row + 1}M`)
    }

    let scrollAccumY = 0
    let scrollAccumX = 0

    function handleWheel(e: WheelEvent) {
        e.preventDefault()
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        if (e.shiftKey) {
            scrollAccumX += e.deltaY / charWidth
            const c = Math.trunc(scrollAccumX)
            if (c !== 0) {
                scrollAccumX -= c
                const button = c < 0 ? (64 | 4) : (65 | 4)
                const count = Math.min(Math.abs(c), 5)
                for (let i = 0; i < count; i++) {
                    onMouseInput(`\x1b[<${button};${col + 1};${row + 1}M`)
                }
            }
        } else {
            scrollAccumY += e.deltaY / lineHeight
            const lines = Math.trunc(scrollAccumY)
            if (lines !== 0) {
                scrollAccumY -= lines
                const button = lines < 0 ? 64 : 65
                const count = Math.min(Math.abs(lines), 5)
                for (let i = 0; i < count; i++) {
                    onMouseInput(`\x1b[<${button};${col + 1};${row + 1}M`)
                }
            }
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
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
        if (seq) onKeyInput(seq)
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    class="terminal-shell"
    bind:this={container}
    tabindex="0"
    role="application"
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
    onmousemove={handleMouseMove}
    onwheel={handleWheel}
    onkeydown={handleKeyDown}
>
    {#if terminal}
        <TerminalView
            terminal={terminal}
            fontSize={computedFontSize}
            lineHeight={1.0}
            {fontFamily}
            {foreground}
            {background}
        />
    {/if}
</div>

<style>
    .terminal-shell {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        outline: none;
        cursor: text;
    }
</style>
