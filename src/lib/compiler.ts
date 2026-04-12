import type { CompileRequest, CompileResult } from './worker/compiler.js'

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (r: CompileResult) => void }>()

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(
            new URL('./worker/compiler.ts', import.meta.url),
            { type: 'module' },
        )
        worker.onmessage = (event: MessageEvent<CompileResult>) => {
            const { id } = event.data
            const entry = pending.get(id)
            if (entry) {
                pending.delete(id)
                entry.resolve(event.data)
            }
        }
        worker.onerror = (event) => {
            console.error('[compiler worker] Error:', event.message)
            // Resolve all pending with error
            for (const [id, entry] of pending) {
                entry.resolve({ id, error: 'Worker error: ' + event.message })
            }
            pending.clear()
        }
    }
    return worker
}

export function compileComponent(source: string): Promise<CompileResult> {
    const id = nextId++
    return new Promise((resolve) => {
        pending.set(id, { resolve })
        getWorker().postMessage({ id, source } satisfies CompileRequest)
    })
}
