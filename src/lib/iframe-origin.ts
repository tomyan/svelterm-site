/**
 * The iframe runs at a separate origin so user code cannot reach into the
 * parent's window. In dev that's `127.0.0.1:5174` (different host+port from
 * the SvelteKit dev server); in prod it's `svelterm-untrusted.net`.
 *
 * Override the dev URL with VITE_IFRAME_ORIGIN if you need TLD-parity dev
 * (e.g. `http://svelterm-untrusted.localhost:5174`).
 */

export const IFRAME_ORIGIN: string =
    import.meta.env.VITE_IFRAME_ORIGIN ??
    (import.meta.env.DEV
        ? 'http://127.0.0.1:5174'
        : 'https://svelterm-untrusted.net')
