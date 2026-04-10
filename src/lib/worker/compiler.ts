/**
 * Web worker that compiles Svelte source code.
 */

import { compile } from 'svelte/compiler'

export interface CompileRequest {
    id: number
    source: string
}

export interface CompileResult {
    id: number
    browser?: { js: string; css: string }
    terminal?: { js: string; css: string }
    error?: string
}

self.onmessage = (event: MessageEvent<CompileRequest>) => {
    const { id, source } = event.data
    const result: CompileResult = { id }

    try {
        const browserResult = compile(source, {
            generate: 'client',
            css: 'injected',
            filename: 'App.svelte',
        })
        result.browser = {
            js: browserResult.js.code,
            css: browserResult.css?.code ?? '',
        }
    } catch (e: any) {
        result.error = e.message
    }

    self.postMessage(result)
}
