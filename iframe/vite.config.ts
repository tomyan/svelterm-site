import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PARENT_ORIGINS = [
    'http://localhost:5173',
    'http://svelterm.localhost:5173',
]

export default defineConfig({
    root: __dirname,
    // Separate dep-optimization cache from the parent vite, which shares
    // node_modules/.vite/deps by default and would clobber our v86 bundle
    // (the parent doesn't `include: ['v86']`, so its rewrite drops the
    // iframe's optimized v86.js and dynamic imports start 404'ing).
    cacheDir: path.resolve(__dirname, '../node_modules/.vite-iframe'),
    plugins: [svelte()],
    resolve: {
        alias: [
            { find: '@svelterm/core/app', replacement: path.resolve(__dirname, '../../svelterm/src/index.ts') },
            { find: '@svelterm/core', replacement: path.resolve(__dirname, '../../svelterm/src/renderer/default.ts') },
        ],
    },
    server: {
        host: '127.0.0.1',
        port: 5174,
        strictPort: true,
        cors: false,
        headers: {
            // frame-ancestors MUST be sent as a header — meta is ignored by browsers.
            // Restricts who can embed this page in an iframe.
            'Content-Security-Policy': `frame-ancestors ${PARENT_ORIGINS.join(' ')}`,
        },
    },
    optimizeDeps: {
        include: ['v86'],
    },
})
