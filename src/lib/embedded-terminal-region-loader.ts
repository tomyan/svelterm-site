/**
 * Compile vt100's EmbeddedTerminalRegion.svelte at runtime with the
 * svelterm custom renderer enabled, then evaluate it as a module so the
 * playground can hand the resulting component to demos that target the
 * terminal preview. Done at site startup; the result is cached.
 */

import { compile, preprocess, type PreprocessorGroup } from 'svelte/compiler'
import ts from 'typescript'
import regionSource from '@svelterm/vt100/EmbeddedTerminalRegion?raw'

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
            },
        })
        return { code: result.outputText }
    },
}

let cachedComponent: any = null

export async function loadEmbeddedTerminalRegion(): Promise<any> {
    if (cachedComponent) return cachedComponent

    const { code: processed } = await preprocess(regionSource, [tsPreprocessor], {
        filename: 'EmbeddedTerminalRegion.svelte',
    })

    const compiled = compile(processed, {
        generate: 'client',
        css: 'external',
        filename: 'EmbeddedTerminalRegion.svelte',
        experimental: {
            customRenderer: '@svelterm/core',
        },
    } as any)

    const rewritten = rewriteImports(compiled.js.code)
    const moduleCode = [
        'const __svelte__ = window.__svelterm_terminal_modules__.svelte;',
        'const __internal__ = window.__svelterm_terminal_modules__.internal;',
        'const __renderer__ = window.__svelterm_terminal_modules__.renderer;',
        'const __vt100__ = window.__svelterm_terminal_modules__.vt100;',
        rewritten,
    ].join('\n')

    const blob = new Blob([moduleCode], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    try {
        const mod = await import(/* @vite-ignore */ url)
        cachedComponent = mod.default
        return cachedComponent
    } finally {
        URL.revokeObjectURL(url)
    }
}

function rewriteImports(code: string): string {
    let out = code
    out = out.replace(/^import\s+['"]svelte[^'"]*['"];?\s*$/gm, '')
    out = out.replace(/^import\s+['"]\@svelterm\/core['"];?\s*$/gm, '')
    out = out.replace(
        /import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]svelte[^'"]*['"]/g,
        'const $1 = __internal__',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]svelte\/[^'"]*['"]/g,
        'const {$1} = __internal__',
    )
    // Public Svelte API (onDestroy, onMount, getContext, …) lives on the
    // top-level `svelte` module, not in svelte/internal/client.
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]svelte['"]/g,
        'const {$1} = __svelte__',
    )
    out = out.replace(
        /import\s+([\w$]+)\s+from\s+['"]\@svelterm\/core['"]/g,
        'const $1 = __renderer__.default',
    )
    // Region.svelte's relative imports (./terminal.js, ./cell.js, ...)
    // resolve into vt100's main entry, which the runtime exposes.
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]\.\/[\w-]+\.js['"]/g,
        'const {$1} = __vt100__',
    )
    return out
}
