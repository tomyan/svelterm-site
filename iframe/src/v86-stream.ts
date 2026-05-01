import type { TerminalStream } from '@svelterm/vt100'

interface V86Bus {
    send(name: string, payload: any): void
}

interface V86Instance {
    add_listener(name: string, fn: (...args: any[]) => void): void
    serial_send_bytes(uart: number, bytes: Uint8Array): void
    destroy(): void
    // Internal bus exposed by libv86 (N.prototype.add_listener delegates
    // to this.bus.register). v86 has no public typed wrapper for sending
    // into virtio-console, so we reach through bus.send directly. Events:
    //   virtio-console0-input-bytes  (Uint8Array — bytes into the guest)
    //   virtio-console0-resize       ([cols, rows] — fires SIGWINCH)
    bus: V86Bus
}

interface V86Module {
    V86: new (opts: any) => V86Instance
}

let modulePromise: Promise<{ V86Module: V86Module; wasmUrl: string }> | null = null

// Cache-bust v86 binary fetches per page load. Vite serves them with
// `Cache-Control: no-cache` already, but iframe-internal fetches sometimes
// hit a stale entry across rebuilds — appending a per-load timestamp guarantees
// a fresh binary every time we boot the emulator.
const CACHE_BUST = `?t=${Date.now()}`

function loadV86() {
    if (!modulePromise) {
        modulePromise = Promise.all([
            import('v86'),
            import('v86/build/v86.wasm?url'),
        ]).then(([mod, wasmMod]) => ({
            V86Module: mod as unknown as V86Module,
            wasmUrl: (wasmMod as { default: string }).default,
        }))
    }
    return modulePromise
}

export interface V86StreamFactory {
    v86Stream(opts?: { uart: 0 | 1 | 2 | 3 }): TerminalStream
    destroy(): void
}

/**
 * Build a `v86Stream({ uart })` factory bound to a single, lazily-created
 * VM. Each call to the returned factory opens a TerminalStream on one of
 * the shared VM's UARTs.
 *
 * Caller pattern: each runtime context (browser-preview iframe parent,
 * terminal-preview parent window) calls `createV86StreamFactory()` once
 * and exposes the resulting `v86Stream` to the demo. That isolates VM
 * state per preview so streams in different previews don't echo each
 * other through a shared emulator. Call `destroy()` when tearing down
 * the runtime context (e.g. before resetting the iframe) so the prior
 * VM is freed and listeners on it stop accumulating.
 */
export function createV86StreamFactory(): V86StreamFactory {
    let emulator: V86Instance | null = null
    let openCount = 0

    function getOrCreateEmulator(V86Module: V86Module, wasmUrl: string): V86Instance {
        if (!emulator) {
            emulator = new V86Module.V86({
                wasm_path: wasmUrl,
                // 128MB so v86's `create_memory(memory_size, initrd ? 64MB : 1MB)`
                // can place the initrd at the 64MB mark without overflowing.
                memory_size: 128 * 1024 * 1024,
                vga_memory_size: 2 * 1024 * 1024,
                bios: { url: '/v86/seabios.bin' + CACHE_BUST },
                vga_bios: { url: '/v86/vgabios.bin' + CACHE_BUST },
                bzimage: { url: '/v86/svelterm-bzimage.bin' + CACHE_BUST },
                // Overlay cpio stamps /sbin/svtinit (replaces busybox-init's
                // busy-loop). Built by /Users/tom/v86-buildroot/build-overlay.sh
                // when rootfs-overlay/ changes. rdinit= (not init=) is required
                // because buildroot's /init script always exec's /sbin/init
                // (busybox) regardless of init= cmdline arg.
                initrd: { url: '/v86/svtinit-overlay.cpio' + CACHE_BUST },
                cmdline: 'rdinit=/sbin/svtinit mitigations=off random.trust_cpu=on tsc=reliable console=hvc0 quiet loglevel=0',
                virtio_console: true,
                autostart: true,
                disable_keyboard: true,
                disable_mouse: true,
            })
            if (import.meta.env.DEV) {
                ;(window as unknown as { __svtV86?: V86Instance }).__svtV86 = emulator
            }
        }
        return emulator
    }

    function v86Stream(_opts?: { uart: 0 | 1 | 2 | 3 }): TerminalStream {
        const outputListeners = new Set<(bytes: Uint8Array) => void>()
        const closeListeners = new Set<(reason: Error | null) => void>()
        let buffered: Uint8Array | null = null
        let closed = false
        let attached: V86Instance | null = null
        // Latest size requested. Buffered until attach (kernel module not
        // ready yet), and re-sent on the kernel's first console output —
        // SIGWINCH delivered to a tty whose virtio_console driver hasn't
        // initialised is silently dropped, so the kernel default (80×24)
        // sticks until something else changes the size. Re-sending after
        // the first output lands a SIGWINCH after init has wired up the
        // tty, so processes started by /sbin/init (getty, login shell)
        // see the right cols/rows.
        let lastSize: [number, number] | null = null
        let resentInitialSize = false
        let pendingWrites: Uint8Array[] = []

        function sendResize(cols: number, rows: number): void {
            if (!attached) return
            attached.bus.send('virtio-console0-resize', [cols, rows])
        }

        openCount++
        loadV86().then(({ V86Module, wasmUrl }) => {
            if (closed) return
            attached = getOrCreateEmulator(V86Module, wasmUrl)
            attached.add_listener('virtio-console0-output-bytes', (bytes: Uint8Array) => {
                if (closed) return
                if (!resentInitialSize && lastSize) {
                    resentInitialSize = true
                    sendResize(lastSize[0], lastSize[1])
                }
                if (outputListeners.size === 0) {
                    buffered = buffered ? concat(buffered, bytes) : bytes
                } else {
                    for (const cb of outputListeners) cb(bytes)
                }
            })
            if (lastSize) sendResize(lastSize[0], lastSize[1])
            for (const bytes of pendingWrites) {
                attached.bus.send('virtio-console0-input-bytes', bytes)
            }
            pendingWrites = []
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
                if (!attached) {
                    pendingWrites.push(bytes)
                    return
                }
                attached.bus.send('virtio-console0-input-bytes', bytes)
            },
            resize(cols, rows) {
                if (closed) return
                lastSize = [cols, rows]
                sendResize(cols, rows)
            },
            onClose(listener) {
                closeListeners.add(listener)
                return () => closeListeners.delete(listener)
            },
            close() {
                if (closed) return
                closed = true
                for (const cb of closeListeners) cb(null)
                openCount--
                if (openCount <= 0) destroy()
            },
        }
    }

    function destroy() {
        openCount = 0
        if (!emulator) return
        try {
            emulator.destroy()
        } catch {
            // v86 may throw on destroy during boot; ignore
        }
        emulator = null
    }

    return { v86Stream, destroy }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    const merged = new Uint8Array(a.length + b.length)
    merged.set(a)
    merged.set(b, a.length)
    return merged
}
