/**
 * Web worker that compiles Svelte source code for both browser
 * and terminal targets.
 */

import { compile, preprocess, type PreprocessorGroup } from 'svelte/compiler'
import ts from 'typescript'

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

const tsPreprocessor: PreprocessorGroup = {
    name: 'typescript',
    script({ content, attributes }) {
        if (attributes.lang !== 'ts' && attributes.lang !== 'typescript') return
        const result = ts.transpileModule(content, {
            compilerOptions: {
                target: ts.ScriptTarget.ESNext,
                module: ts.ModuleKind.ESNext,
                isolatedModules: true,
                verbatimModuleSyntax: true,
                preserveValueImports: false,
            },
        })
        return { code: result.outputText }
    },
}

self.onmessage = async (event: MessageEvent<CompileRequest>) => {
    const { id, source } = event.data
    const result: CompileResult = { id }

    let processed = source
    try {
        const pp = await preprocess(source, [tsPreprocessor], { filename: 'App.svelte' })
        processed = pp.code
    } catch (e: any) {
        result.error = e.message
        self.postMessage(result)
        return
    }

    // Browser compilation — standard client mode
    try {
        const browserResult = compile(processed, {
            generate: 'client',
            css: 'injected',
            filename: 'App.svelte',
            experimental: { async: true },
        } as any)
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
            const terminalResult = compile(processed, {
                generate: 'client',
                css: 'external',
                filename: 'App.svelte',
                experimental: {
                    customRenderer: '@svelterm/core',
                    async: true,
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
