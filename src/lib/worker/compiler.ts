/**
 * Web worker that compiles Svelte source code for both browser
 * and terminal targets.
 */

import { compile } from 'svelte/compiler'
import { compile as forkCompile } from 'svelte-fork-compiler'

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

    // Browser compilation — stock Svelte
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

    // Terminal compilation — fork with customRenderer
    if (!result.error) {
        try {
            const terminalResult = forkCompile(source, {
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
            // Terminal compilation may fail — don't block browser preview
            result.terminal = undefined
        }
    }

    self.postMessage(result)
}
