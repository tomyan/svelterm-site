<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import EmbeddedTerminal from '@svelterm/vt100/EmbeddedTerminalDom'
    import type { TerminalStream } from '@svelterm/vt100'
    import { V86 } from 'v86'
    import v86WasmUrl from 'v86/build/v86.wasm?url'

    let {
        cols = 80,
        rows = 24,
    }: {
        cols?: number
        rows?: number
    } = $props()

    let emulator: V86 | null = null
    let stream: TerminalStream | null = $state(null)

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
        stream = makeV86Stream(emulator, 0)
    })

    onDestroy(() => {
        try {
            emulator?.destroy()
        } catch {
            // v86 may throw on destroy during boot; ignore
        }
        emulator = null
        stream?.close()
    })

    /**
     * Wrap one of v86's UARTs as a TerminalStream. Buffers output before
     * the first onOutput subscriber so boot bytes emitted in the moment
     * between v86 starting and the consumer attaching aren't lost.
     *
     * Resize is a no-op: v86's serial console doesn't have a window-size
     * channel, so the guest sees a fixed 80x24. Leaving the slot in case
     * we later wire up a kernel hook to send SIGWINCH.
     */
    function makeV86Stream(emu: V86, uart: 0 | 1 | 2 | 3): TerminalStream {
        const outputListeners = new Set<(bytes: Uint8Array) => void>()
        const closeListeners = new Set<(reason: Error | null) => void>()
        let buffered: Uint8Array | null = null
        let pendingBytes: number[] = []
        let flushScheduled = false
        let closed = false

        function flush() {
            flushScheduled = false
            if (pendingBytes.length === 0) return
            const bytes = new Uint8Array(pendingBytes)
            pendingBytes = []
            if (outputListeners.size === 0) {
                buffered = buffered ? concat(buffered, bytes) : bytes
            } else {
                for (const cb of outputListeners) cb(bytes)
            }
        }

        emu.add_listener(`serial${uart}-output-byte`, (byte: number) => {
            pendingBytes.push(byte)
            if (!flushScheduled) {
                flushScheduled = true
                queueMicrotask(flush)
            }
        })

        return {
            onOutput(listener) {
                outputListeners.add(listener)
                if (buffered) {
                    listener(buffered)
                    buffered = null
                }
                return () => outputListeners.delete(listener)
            },
            write(bytes) {
                if (closed) return
                emu.serial_send_bytes(uart, bytes)
            },
            resize(_cols, _rows) {
                // v86 serial console has no window-size channel.
            },
            onClose(listener) {
                closeListeners.add(listener)
                return () => closeListeners.delete(listener)
            },
            close() {
                if (closed) return
                closed = true
                for (const cb of closeListeners) cb(null)
            },
        }
    }

    function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
        const merged = new Uint8Array(a.length + b.length)
        merged.set(a)
        merged.set(b, a.length)
        return merged
    }
</script>

<div class="shell">
    {#if stream}
        <EmbeddedTerminal {stream} {cols} {rows} />
    {/if}
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
