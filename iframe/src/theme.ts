import type { ThemeMode } from './protocol.js'

/**
 * Drive the iframe's theme via `<html data-theme="...">`. We can't rely on
 * `prefers-color-scheme` matching the parent toggle — in a cross-origin
 * iframe that media query is bound to OS settings. So the parent posts a
 * theme message and we set an attribute that user CSS (after rewrite) and
 * iframe-local rules can target.
 */
export function applyTheme(mode: ThemeMode): void {
    const root = document.documentElement
    if (mode === 'dark' || mode === 'light') {
        root.setAttribute('data-theme', mode)
        root.style.colorScheme = mode
    } else {
        root.removeAttribute('data-theme')
        root.style.colorScheme = ''
    }
}

/** Resolve a possibly-'auto' theme mode to a concrete dark/light scheme. */
export function resolveScheme(mode: ThemeMode): 'dark' | 'light' {
    if (mode === 'dark' || mode === 'light') return mode
    if (typeof window !== 'undefined'
        && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
    return 'dark'
}
