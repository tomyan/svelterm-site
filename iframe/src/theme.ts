import type { ThemeMode } from './protocol.js'

export function applyTheme(mode: ThemeMode): void {
    const root = document.documentElement
    if (mode === 'dark') root.style.colorScheme = 'dark'
    else if (mode === 'light') root.style.colorScheme = 'light'
    else root.style.colorScheme = ''
}
