import type { TerminalStream } from '@svelterm/vt100'

interface V86Instance {
    add_listener(name: string, fn: (...args: any[]) => void): void
    serial_send_bytes(uart: number, bytes: Uint8Array): void
    destroy(): void
}

interface V86Module {
    V86: new (opts: any) => V86Instance
}

let modulePromise: Promise<{ V86Module: V86Module; wasmUrl: string }> | null = null

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
        }
        return emulator
    }

    function v86Stream({ uart }: { uart: 0 | 1 | 2 | 3 } = { uart: 0 }): TerminalStream {
        const outputListeners = new Set<(bytes: Uint8Array) => void>()
        const closeListeners = new Set<(reason: Error | null) => void>()
        let buffered: Uint8Array | null = null
        let pendingBytes: number[] = []
        let flushScheduled = false
        let closed = false
        let attached: V86Instance | null = null

        openCount++
        loadV86().then(({ V86Module, wasmUrl }) => {
            if (closed) return
            attached = getOrCreateEmulator(V86Module, wasmUrl)
            attached.add_listener(`serial${uart}-output-byte`, (byte: number) => {
                if (closed) return
                pendingBytes.push(byte)
                if (!flushScheduled) {
                    flushScheduled = true
                    queueMicrotask(flush)
                }
            })
        })

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
                if (closed || !attached) return
                attached.serial_send_bytes(uart, bytes)
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
