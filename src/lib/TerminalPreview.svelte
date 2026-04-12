<script lang="ts">
    import { onMount } from 'svelte';
    import { Terminal } from '@svelterm/vt100';
    import { TerminalRenderer } from '@svelterm/vt100/dom';

    let {
        cols = 40,
        rows = 15,
        terminalJs = '',
        terminalCss = '',
        onInput = undefined as ((data: string) => void) | undefined,
    }: {
        cols?: number
        rows?: number
        terminalJs?: string
        terminalCss?: string
        onInput?: (data: string) => void
    } = $props()

    let container: HTMLElement
    let terminal: Terminal
    let renderer: TerminalRenderer
    let charWidth = 0
    let lineHeight = 0

    onMount(() => {
        terminal = new Terminal(cols, rows)
        renderer = new TerminalRenderer(container, terminal, {
            fontSize: 13,
            lineHeight: 1.3,
            foreground: '#c9d1d9',
            background: '#0d1117',
            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        })

        measureChar()

        return () => renderer.dispose()
    })

    // When terminal JS changes, re-run the component
    $effect(() => {
        if (!terminal || !renderer) return
        const js = terminalJs
        const css = terminalCss
        if (!js) return

        // Clear terminal
        terminal.write('\x1b[2J\x1b[H')

        // TODO: evaluate the compiled JS, run svelterm with InProcessIO,
        // connect output to terminal.write(), render
        // For now, show a message
        terminal.write('\x1b[36mTerminal preview loading...\x1b[0m\r\n')
        terminal.write(`\x1b[90mJS: ${js.length} bytes, CSS: ${css.length} bytes\x1b[0m\r\n`)

        renderer.render()
    })

    export function write(data: string): void {
        terminal?.write(data)
        renderer?.render()
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
        charWidth = span.getBoundingClientRect().width
        lineHeight = 13 * 1.3
        document.body.removeChild(span)
    }

    function pixelToCell(clientX: number, clientY: number): { col: number; row: number } {
        const rect = container.getBoundingClientRect()
        const x = clientX - rect.left - 4
        const y = clientY - rect.top - 4
        return {
            col: Math.max(0, Math.min(cols - 1, Math.floor(x / charWidth))),
            row: Math.max(0, Math.min(rows - 1, Math.floor(y / lineHeight))),
        }
    }

    function encodeSgrMouse(button: number, col: number, row: number, press: boolean): string {
        return `\x1b[<${button};${col + 1};${row + 1}${press ? 'M' : 'm'}`
    }

    function handleMouseDown(e: globalThis.MouseEvent) {
        if (!onInput) return
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        const button = e.button === 0 ? 0 : e.button === 1 ? 1 : 2
        onInput(encodeSgrMouse(button, col, row, true))
    }

    function handleMouseUp(e: globalThis.MouseEvent) {
        if (!onInput) return
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        const button = e.button === 0 ? 0 : e.button === 1 ? 1 : 2
        onInput(encodeSgrMouse(button, col, row, false))
    }

    function handleWheel(e: WheelEvent) {
        if (!onInput) return
        e.preventDefault()
        const { col, row } = pixelToCell(e.clientX, e.clientY)
        const button = e.deltaY < 0 ? 64 : 65
        onInput(encodeSgrMouse(button, col, row, true))
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!onInput) return
        e.preventDefault()
        const seq = keyToAnsi(e)
        if (seq) onInput(seq)
    }

    function keyToAnsi(e: KeyboardEvent): string | null {
        if (e.ctrlKey && e.key.length === 1) {
            const code = e.key.toLowerCase().charCodeAt(0) - 0x60
            if (code >= 1 && code <= 26) return String.fromCharCode(code)
        }
        switch (e.key) {
            case 'Enter': return '\r'
            case 'Backspace': return '\x7f'
            case 'Tab': return e.shiftKey ? '\x1b[Z' : '\t'
            case 'Escape': return '\x1b'
            case 'ArrowUp': return '\x1b[A'
            case 'ArrowDown': return '\x1b[B'
            case 'ArrowRight': return '\x1b[C'
            case 'ArrowLeft': return '\x1b[D'
            case 'Home': return '\x1b[H'
            case 'End': return '\x1b[F'
            case 'Delete': return '\x1b[3~'
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) return e.key
        return null
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
