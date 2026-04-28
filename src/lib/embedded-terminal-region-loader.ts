/**
 * Compile vt100's EmbeddedTerminalRegion.svelte with the svelterm custom
 * renderer enabled. Returns the compiled JS string that the iframe can
 * evaluate as a Blob module — its bare imports have been rewritten to
 * read from the iframe's `window.__rt__` runtime object.
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

let cachedCode: string | null = null

export async function compileEmbeddedTerminalRegion(): Promise<string> {
    if (cachedCode) return cachedCode

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

    cachedCode = rewriteImports(compiled.js.code)
    return cachedCode
}

function rewriteImports(code: string): string {
    let out = code
    out = out.replace(/^import\s+['"]svelte[^'"]*['"];?\s*$/gm, '')
    out = out.replace(/^import\s+['"]\@svelterm\/core['"];?\s*$/gm, '')
    out = out.replace(
        /import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]svelte[^'"]*['"]/g,
        'const $1 = window.__rt__.svelteInternal',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]svelte\/[^'"]*['"]/g,
        'const {$1} = window.__rt__.svelteInternal',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]svelte['"]/g,
        'const {$1} = window.__rt__.svelte',
    )
    out = out.replace(
        /import\s+([\w$]+)\s+from\s+['"]\@svelterm\/core['"]/g,
        'const $1 = window.__rt__.sveltermCore.default',
    )
    out = out.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]\.\/[\w-]+\.js['"]/g,
        'const {$1} = window.__rt__.vt100',
    )
    return out
}
