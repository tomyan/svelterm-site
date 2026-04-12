/**
 * Web worker that compiles Svelte source code for both browser
 * and terminal targets.
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

    // Browser compilation — standard client mode
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

    // Terminal compilation — client mode with custom renderer
    if (!result.error) {
        try {
            const terminalResult = compile(source, {
                generate: 'client',
                css: 'external',
                filename: 'App.svelte',
                experimental: {
                    customRenderer: '@svelterm/core',
                },
            } as any)
            result.terminal = {
                js: terminalResult.js.code,
                css: terminalResult.css?.code ?? '',
            }
        } catch (e: any) {
            // Include error info for debugging
            result.terminal = undefined
            ;(result as any).terminalError = e.message
        }
    }

    self.postMessage(result)
}
