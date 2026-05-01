<script lang="ts">
    import { onMount, onDestroy } from 'svelte'
    import { theme } from './theme.svelte.js'
    import { IFRAME_ORIGIN } from './iframe-origin.js'
    import type { PreviewMode, ParentMessage } from '../../iframe/src/protocol.js'

    let {
        mode,
        code,
        css,
        regionCode,
        onSize = (_cols: number, _rows: number) => {},
        onError = (_message: string) => {},
    } = $props<{
        mode: PreviewMode
        code: string
        css: string
        regionCode?: string
        onSize?: (cols: number, rows: number) => void
        onError?: (message: string) => void
    }>()

    let iframe: HTMLIFrameElement
    let ready = $state(false)

    function post(message: ParentMessage) {
        if (!iframe?.contentWindow) return
        iframe.contentWindow.postMessage(message, IFRAME_ORIGIN)
    }

    function handleIframeMessage(event: MessageEvent) {
        if (event.origin !== IFRAME_ORIGIN) return
        if (event.source !== iframe.contentWindow) return
        const msg = event.data
        if (!msg || typeof msg !== 'object') return
        if (msg.kind === 'ready') {
            ready = true
        } else if (msg.kind === 'size') {
            onSize(msg.cols, msg.rows)
        } else if (msg.kind === 'error') {
            onError(msg.message)
        }
    }

    function handleIframeLoad() {
        post({ kind: 'init', mode, theme: theme.mode })
    }

    onMount(() => {
        window.addEventListener('message', handleIframeMessage)
    })

    onDestroy(() => {
        window.removeEventListener('message', handleIframeMessage)
        if (ready) post({ kind: 'destroy' })
    })

    $effect(() => {
        const c = code
        const cs = css
        const rc = regionCode
        if (!c || !ready) return
        post({ kind: 'mount', code: c, css: cs, regionCode: rc })
    })

    $effect(() => {
        const m = theme.mode
        if (!ready) return
        post({ kind: 'theme', mode: m })
    })
</script>

<iframe
    bind:this={iframe}
    src={IFRAME_ORIGIN + '/'}
    onload={handleIframeLoad}
    sandbox="allow-scripts allow-same-origin"
    title={mode === 'terminal' ? 'Terminal preview' : 'Browser preview'}
></iframe>

<style>
    iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: transparent;
        display: block;
    }
</style>
