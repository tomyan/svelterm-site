export interface Example {
    name: string
    code: string
}

const modules = import.meta.glob('./*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const examples: Example[] = Object.entries(modules)
    .map(([path, code]) => ({
        name: path.replace('./', '').replace('.txt', '').replace(/-/g, ' '),
        code: code.trim(),
    }))
    .sort((a, b) => {
        // Embedded terminal is the most advanced example — put it last so
        // simpler examples lead the demo.
        if (a.name === 'embedded terminal') return 1
        if (b.name === 'embedded terminal') return -1
        return a.name.localeCompare(b.name)
    })
