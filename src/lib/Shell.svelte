<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { Terminal, keyEventToBytes } from '@svelterm/vt100'
    import TerminalView from '@svelterm/vt100/svelte'
    import { V86 } from 'v86'
    import v86WasmUrl from 'v86/build/v86.wasm?url'

    let {
        cols = 80,
        rows = 24,
    }: {
        cols?: number
        rows?: number
    } = $props()

    const terminal = new Terminal(cols, rows)

    let container: HTMLElement
    let emulator: V86 | null = null
    let pendingBytes: number[] = []
    let flushScheduled = false

    function flush() {
        flushScheduled = false
        if (pendingBytes.length === 0) return
        const bytes = new Uint8Array(pendingBytes)
        pendingBytes = []
        terminal.write(bytes)
    }

    function scheduleFlush() {
        if (flushScheduled) return
        flushScheduled = true
        queueMicrotask(flush)
    }

    onMount(() => {
        emulator = new V86({
            wasm_path: v86WasmUrl,
            memory_size: 64 * 1024 * 1024,
            vga_memory_size: 2 * 1024 * 1024,
            bios: { url: '/v86/seabios.bin' },
            vga_bios: { url: '/v86/vgabios.bin' },
            bzimage: { url: '/v86/buildroot-bzimage.bin' },
            cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on console=ttyS0',
            filesystem: {},
            autostart: true,
            disable_keyboard: true,
            disable_mouse: true,
        })

        emulator.add_listener('serial0-output-byte', (byte: number) => {
            pendingBytes.push(byte)
            scheduleFlush()
        })

        container?.focus()
    })

    onDestroy(() => {
        try {
            emulator?.destroy()
        } catch {
            // v86 may throw on destroy during boot; ignore
        }
        emulator = null
    })

    function handleKeydown(event: KeyboardEvent) {
        const bytes = keyEventToBytes(event)
        if (bytes.length === 0) return
        event.preventDefault()
        emulator?.serial_send_bytes(0, bytes)
    }
</script>

<div
    bind:this={container}
    class="shell"
    tabindex="0"
    role="application"
    aria-label="Embedded Linux shell"
    onkeydown={handleKeydown}
>
    <TerminalView {terminal} />
</div>

<style>
    .shell {
        width: 100%;
        height: 100%;
        outline: none;
        background: #000;
        padding: 8px;
        box-sizing: border-box;
    }
</style>
