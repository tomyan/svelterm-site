export type ThemeMode = 'auto' | 'dark' | 'light'

class ThemeState {
    mode = $state<ThemeMode>('auto')
}

export const theme = new ThemeState()

export function setThemeMode(m: ThemeMode) {
    theme.mode = m
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('theme', m)
    }
    applyTheme(m)
}

export function cycleThemeMode() {
    const next: ThemeMode = theme.mode === 'auto' ? 'dark' : theme.mode === 'dark' ? 'light' : 'auto'
    setThemeMode(next)
}

export function initTheme() {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('theme') as ThemeMode | null
        if (saved === 'dark' || saved === 'light' || saved === 'auto') {
            theme.mode = saved
        }
    }
    applyTheme(theme.mode)
}

function applyTheme(m: ThemeMode) {
    if (typeof document === 'undefined') return
    const html = document.documentElement
    html.removeAttribute('data-theme')
    if (m === 'dark' || m === 'light') {
        html.setAttribute('data-theme', m)
    }
}
