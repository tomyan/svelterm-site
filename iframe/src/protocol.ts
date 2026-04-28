/**
 * postMessage protocol between the parent (svelterm site) and the iframe
 * (svelterm-untrusted origin). Messages are validated by `event.origin` on
 * both sides; this file just describes the shape.
 */

export type PreviewMode = 'browser' | 'terminal'
export type ThemeMode = 'light' | 'dark' | 'auto'

export interface ParentToIframe {
    init: { mode: PreviewMode; theme: ThemeMode }
    mount: { code: string; css: string; regionCode?: string }
    theme: { mode: ThemeMode }
    destroy: Record<string, never>
}

export interface IframeToParent {
    ready: Record<string, never>
    size: { cols: number; rows: number }
    error: { message: string }
}

export type ParentMessage = {
    [K in keyof ParentToIframe]: { kind: K } & ParentToIframe[K]
}[keyof ParentToIframe]

export type IframeMessage = {
    [K in keyof IframeToParent]: { kind: K } & IframeToParent[K]
}[keyof IframeToParent]
