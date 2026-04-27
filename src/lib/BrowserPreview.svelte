<script lang="ts">
    import { onMount } from 'svelte'
    import { compileComponent } from './compiler.js'
    import { theme } from './theme.svelte.js'

    let { source = '' } = $props()
    let iframe: HTMLIFrameElement
    let error = $state('')
    let ready = $state(false)
    let debounceTimer: ReturnType<typeof setTimeout>

    $effect(() => {
        if (!ready) return
        const src = source
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
            recompile(src)
        }, 500)
    })

    async function recompile(src: string) {
        if (!iframe || !src.trim()) return

        try {
            const result = await compileComponent(src)
            if (result.error) {
                error = result.error
                return
            }
            error = ''
            if (result.browser) {
                mountInIframe(result.browser.js, result.browser.css)
            }
        } catch (e: any) {
            error = e.message
        }
    }

    function rewriteImports(js: string): string {
        let code = js
        code = code.replace(/^import\s+['"]svelte[^'"]*['"];?\s*$/gm, '')
        code = code.replace(/^import\s+['"]\@svelterm\/core['"];?\s*$/gm, '')
        code = code.replace(/import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]svelte[^'"]*['"]/g,
            'const $1 = __internal__')
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]svelte\/[^'"]*['"]/g,
            'const {$1} = __internal__')
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]svelte['"]/g,
            'const {$1} = __svelte__')
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]\@svelterm\/core['"]/g,
            'const {$1} = __sveltermCore__')
        code = code.replace(/import\s+\{([^}]+)\}\s+from\s+['"]v86-stream['"]/g,
            'const {$1} = __v86__')
        code = code.replace(
            /import\(\s*['"]\@svelterm\/vt100\/EmbeddedTerminalDom['"]\s*\)/g,
            'Promise.resolve({ default: window.__svelterm_rt__.embeddedTerminalDom })',
        )
        code = code.replace(
            /import\(\s*['"]\@svelterm\/vt100\/EmbeddedTerminalRegion['"]\s*\)/g,
            'Promise.reject(new Error("EmbeddedTerminalRegion is not available in the browser preview"))',
        )
        return code
    }

    function rewriteCssInJs(js: string): string {
        // The compiled JS has a $$css = { code: '...css...' } object.
        // The CSS string uses \n for newlines and is single-quoted.
        // Rewrite to unwrap @media (display-mode: browser) and strip terminal.
        return js.replace(/(code:\s*')([\s\S]*?)(')/g, (_match, pre, css, post) => {
            let result = css
            // Unwrap browser media queries (content between { and } may contain nested braces from selectors)
            result = result.replace(/@media\s*\(display-mode:\s*browser\)\s*\{((?:[^{}]|\{[^{}]*\})*)\s*\}/g, '$1')
            // Strip terminal media queries
            result = result.replace(/@media\s*\(display-mode:\s*terminal\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
            return pre + result + post
        })
    }

    function mountInIframe(js: string, _css: string) {
        // The previous iframe context is about to be discarded; the demo
        // running inside has no chance to fire onDestroy and close its
        // streams. Tear down the v86 VM here so listeners on the dying
        // iframe stop accumulating against a still-live emulator.
        v86Factory?.destroy()
        const rewritten = rewriteCssInJs(rewriteImports(js))
        const moduleCode = [
            'const __svelte__ = window.__svelterm_rt__.svelte;',
            'const __internal__ = window.__svelterm_rt__.internal;',
            'const __sveltermCore__ = window.__svelterm_rt__.sveltermCore;',
            'const __v86__ = { v86Stream: window.__svelterm_rt__.v86Stream };',
            rewritten,
        ].join('\n')

        // Use srcdoc with a listener that receives the code via postMessage
        iframe.srcdoc = iframeHtml()

        // Wait for iframe to load, then send the code
        iframe.onload = () => {
            iframe.contentWindow?.postMessage({
                type: 'mount-component',
                code: moduleCode,
            }, '*')
        }
    }

    function iframeHtml(): string {
        // Use an array join to avoid template literal issues with script tags
        const parts = [
            '<!doctype html><html><head><style>',
            ':root { color-scheme: dark; --fg: #e6edf3; --bg: #0d1117; --border: #555; --border-form: #30363d; }',
            '@media (prefers-color-scheme: light) { :root { color-scheme: light; --fg: #1a1a2e; --bg: #ffffff; --border: #999; --border-form: #d0d7de; } }',
            '* { margin: 0; padding: 0; box-sizing: border-box; }',
            'body { font-family: system-ui, -apple-system, sans-serif; padding: 1rem; color: var(--fg); background: var(--bg); }',
            'button { cursor: pointer; padding: 0.25rem 0.75rem; background: transparent; color: inherit; border: 1px solid var(--border); border-radius: 4px; }',
            'input, textarea { font-family: inherit; padding: 0.25rem; background: var(--bg); color: var(--fg); border: 1px solid var(--border-form); border-radius: 4px; }',
            '',
            '</style></head><body><div id="app"></div>',
            '<script type="module">',
            'window.addEventListener("message", async (event) => {',
            '  if (event.data?.type !== "mount-component") return;',
            '  window.__svelterm_rt__ = {',
            '    svelte: window.parent.__svelterm_modules__.svelte,',
            '    internal: window.parent.__svelterm_modules__.internal,',
            '    sveltermCore: window.parent.__svelterm_modules__.sveltermCore,',
            '    embeddedTerminalDom: window.parent.__svelterm_modules__.embeddedTerminalDom,',
            '    v86Stream: window.parent.__svelterm_modules__.v86Stream,',
            '  };',
            '  // Vite-plugin-svelte injects scoped component styles into the',
            '  // parent document. Library components mounted in the iframe',
            '  // (EmbeddedTerminalDom, TerminalView, ...) reference those',
            '  // class hashes, so clone them in.',
            '  for (const style of window.parent.document.querySelectorAll("style[data-vite-dev-id]")) {',
            '    document.head.appendChild(style.cloneNode(true));',
            '  }',
            '  const blob = new Blob([event.data.code], { type: "text/javascript" });',
            '  const url = URL.createObjectURL(blob);',
            '  try {',
            '    const mod = await import(url);',
            '    URL.revokeObjectURL(url);',
            '    const app = document.getElementById("app");',
            '    app.innerHTML = "";',
            '    window.__svelterm_rt__.svelte.mount(mod.default, { target: app });',
            '  } catch (e) {',
            '    document.getElementById("app").innerHTML =',
            '      "<pre style=\\"color:#c00;font-size:12px;white-space:pre-wrap\\">" +',
            '      e.message + "\\n" + (e.stack || "") + "</pre>";',
            '  }',
            '});',
            '</' + 'script></body></html>',
        ]
        return parts.join('\n')
    }

    $effect(() => {
        const m = theme.mode
        if (!iframe?.contentDocument) return
        const root = iframe.contentDocument.documentElement
        if (m === 'dark') {
            root.style.colorScheme = 'dark'
        } else if (m === 'light') {
            root.style.colorScheme = 'light'
        } else {
            root.style.colorScheme = ''
        }
    })

    onMount(() => {
        loadModules()
        return () => {
            clearTimeout(debounceTimer)
        }
    })

    let v86Factory: { v86Stream: (...args: any[]) => any; destroy: () => void } | null = null

    async function loadModules() {
        const [svelteModule, internalModule, discloseModule, flagsModule, embeddedTerminalDomModule, v86StreamModule, sveltermCoreModule] = await Promise.all([
            import('svelte'),
            import(/* @vite-ignore */ 'svelte/internal/client'),
            import(/* @vite-ignore */ 'svelte/internal/disclose-version').catch(() => ({})),
            import(/* @vite-ignore */ 'svelte/internal/flags/legacy').catch(() => ({})),
            import('@svelterm/vt100/EmbeddedTerminalDom'),
            import('./v86-stream.js'),
            import('@svelterm/core'),
        ]);

        const allInternal = { ...internalModule, ...discloseModule, ...flagsModule };
        v86Factory = (v86StreamModule as any).createV86StreamFactory();

        (window as any).__svelterm_modules__ = {
            svelte: svelteModule,
            internal: allInternal,
            sveltermCore: sveltermCoreModule,
            embeddedTerminalDom: (embeddedTerminalDomModule as any).default,
            v86Stream: v86Factory!.v86Stream,
        };

        ready = true
    }
</script>

<div class="browser-preview">
    {#if error}
        <div class="error">{error}</div>
    {/if}
    <iframe
        bind:this={iframe}
        title="Browser preview"
        sandbox="allow-scripts allow-same-origin"
    ></iframe>
</div>

<style>
    .browser-preview {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    iframe {
        flex: 1;
        width: 100%;
        min-height: 0;
        border: none;
        background: var(--color-bg);
    }

    .error {
        padding: 0.5rem 1rem;
        color: var(--color-error);
        font-family: monospace;
        font-size: 0.8rem;
        white-space: pre-wrap;
        background: var(--color-error-bg);
    }
</style>
