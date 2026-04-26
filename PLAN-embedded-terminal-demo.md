# Embedded terminal demo

The initial playground demo: an embedded terminal pane (or two, split via
flexbox) running a real Linux shell via v86. Renders correctly in both
browser preview (DOM) and terminal preview (svelterm-rendered ANSI). The
same primitive that a real tmux clone would build on.

## Design decisions

- **Renderer dispatch.** A new `EmbeddedTerminal` component in
  `@svelterm/vt100`. In the browser target, wraps `TerminalView` (per-cell
  positioned DOM divs — visual quality on real displays). In the svelterm
  target, wraps a new svelterm-core `<svt-region>` node: the embedded
  terminal interprets stream bytes through its own Terminal and paints
  the resulting cell grid into the region. Same component, two paths.
  (This is how tmux works: each pane has its own VT state machine; tmux
  composites cell grids — there is no raw byte passthrough.)

- **Target detection.** Script-level (CSS `@media (display-mode)` only
  swaps visual rules; the script bodies for the two paths are different
  enough that we need a runtime check). Mechanism: Svelte 5 context
  seeded by svelterm's `run()` via the `mount()` `context` option.
  `EmbeddedTerminal` reads it with `getContext` and defaults to
  `'browser'` when absent (plain browser-Svelte mount). Per-mount-scoped
  — survives the playground's two-runtimes-one-tab setup, unlike a
  global flag. Key uses `Symbol.for('@svelterm/target')` so packages
  can compute it independently without an import dependency.

  ```ts
  // in @svelterm/core's run():
  mount(Component, {
      target,
      props,
      context: new Map([[Symbol.for('@svelterm/target'), 'terminal']]),
  })

  // in EmbeddedTerminal.svelte:
  const target = getContext<'browser' | 'terminal'>(
      Symbol.for('@svelterm/target')
  ) ?? 'browser'
  ```

- **`<svt-region>` (new svelterm core primitive).** Participates in
  flexbox layout, gets allocated a cell region of width × height. Hybrid
  API:

  - Markup: `<svt-region bind:this={region} onresize={(cols, rows) => ...} />`
  - On layout (initial mount + every resize): fires `onresize(cols, rows)`
    with the allocated cell dimensions.
  - Imperative: `region.paint(bytes)` writes ANSI bytes filling the
    region. The consumer is responsible for keeping bytes in-region; a
    Terminal sized to the allocated dimensions does that naturally.

  Resize handling is required, not a follow-up.

- **Stream interface.** Target-neutral byte channel + resize. Listener
  pattern over Web Streams / async iterators (sync delivery fits both
  render path and Svelte `$effect` cleanup). Bytes are always
  `Uint8Array` — no string at the boundary so partial UTF-8 across
  writes can't break. One lifecycle channel via `onClose(reason)` —
  clean end is `null`, broken is `Error`. Bytes emitted before the
  first `onOutput` subscriber are buffered and flushed on subscribe.

  ```ts
  export interface TerminalStream {
      onOutput(listener: (bytes: Uint8Array) => void): () => void
      write(bytes: Uint8Array): void
      resize(cols: number, rows: number): void
      onClose(listener: (reason: Error | null) => void): () => void
      close(): void
  }
  ```

  The demo provides streams; `EmbeddedTerminal` is a pure consumer.

- **v86 backing.** The demo backs each pane with a v86 UART. One VM per
  runtime context (browser preview gets one, terminal preview gets a
  second). UARTs `serial0..serial3` give up to four shells per VM; the
  demo uses 1 or 2.

- **Lazy loading.** The `v86Stream` factory dynamic-imports v86 itself.
  v86 + bzImage are only fetched when this demo is selected and mounts.
  Shared HTTP cache between the two previews so only one network fetch
  per page load.

- **Chrome.** Inline in the demo source. Just flexbox between (up to) two
  panes. No tabs, no status bar, no key-shortcut routing. The full thing
  is the demo's whole code, kept short enough that the audience can read
  it. ~50–80 lines.

- **v86Stream location.** `svelterm-site/src/lib/v86-stream.ts`. Private
  to the site for now; promote to a package only if reused elsewhere.

- **Shell.svelte's fate.** Removed once the playground demo lands. The
  playground version is strictly more interesting — live editable,
  dual-target, the source visible.

## Slices (elephant-carpaccio)

Each slice ends with a working, committable, demonstrable state. Tests
where the unit under change is testable; manual hubcap verification for
integration.

### Slice 1 — svelterm region node

**In `svelterm`:** add a node type that participates in layout (sizes via
flexbox like any other element), accepts a byte stream input, emits those
bytes verbatim at its allocated position when rendered, and surfaces
layout-allocated size back to the consumer so they can resize their
upstream Terminal.

**Test up front:** layout participation (region fills `flex: 1`,
shrinks/grows as expected, reports correct size on resize). Stream input →
output bytes hit the buffer at the right position. Resize event fires when
allocated size changes. Pure logic, fully unit-testable.

**Manually validated:** a minimal one-off demo painting a hardcoded
greeting into an `<svt-region>` renders correctly inside a svelterm app.

### Slice 2 — `EmbeddedTerminal` in `@svelterm/vt100`

**In `@svelterm/vt100`:** add `EmbeddedTerminal.svelte`. Props: `stream`
(TerminalStream). Internally:

- Owns a `Terminal` sized to the allocated cell space.
- Subscribes `stream.onOutput` → `terminal.write`.
- Captures container keystrokes → `keyEventToBytes` → `stream.write`.
- Observes own size → `terminal.resize` → `stream.resize` → notify
  region (svelterm target) of new size.
- Renders `<TerminalView terminal={terminal}>` in the browser target.
- Renders the region node fed from `stream.onOutput` in the svelterm
  target.

Per-target dispatch via `@media (display-mode: browser/terminal)` if it
fits, otherwise via `display-mode` checks in the script — mechanism
chosen during implementation.

**Refactor:** `Shell.svelte` to use `EmbeddedTerminal` so the new
primitive has a real consumer immediately and we know the wiring works
end-to-end. Behavior should be unchanged.

**Test up front:** size-allocation feedback (allocated 80×24 → terminal
resized to 80×24), stream wiring direction (output bytes → terminal,
keystrokes → stream).

**Manually validated:** Shell demo continues to work identically.

### Slice 3 — `v86Stream` + single-pane playground demo

**In `svelterm-site/src/lib/v86-stream.ts`:** add `v86Stream({ uart })`
helper that lazy-imports v86 on first call, lazily creates the per-context
VM if not already created, and returns a `TerminalStream` attached to the
specified UART. Multiple calls within the same context share one VM.

**In `svelterm-site/src/lib/examples/`:** add `embedded-terminal.txt`.
Single pane, one shell. Set as the first entry in `examples/index.ts` so
it's default-selected.

**In `svelterm-site/src/lib/svelterm-runtime.js`:** expose
`@svelterm/vt100/EmbeddedTerminal` and `v86Stream` to compiled demos via
the runtime modules object.

**Test up front:** none specific — the heavy lifting is in slices 1 and
2; this one is integration.

**Manually validated:** demo renders in both previews. v86 only loads
when demo selected (verify with browser network tab — Counter selected by
default elsewhere, network shows zero v86 traffic until embedded-terminal
selected).

### Slice 4 — Two-pane split + remove Shell.svelte

**In the demo source:** add a button to split (and another to close
the second pane). Simpler for a demo than tmux-style key chords, and
the button itself becomes part of the visible chrome the audience can
see and modify. Layout: flexbox row, each pane gets `flex: 1`. Each
pane has its own UART/stream.

**Remove:** Shell.svelte and ShellLaunch.svelte from the landing page.
Strip the v86 import paths now living only inside `v86Stream`.

**Manually validated:** split works in both previews, splits work
identically across views, both previews fit within the playground panel
without scroll-leak, removing Shell.svelte doesn't regress the page
layout.

## Open questions

- **Single-VM-per-context vs single-VM-per-pane.** Currently planning
  single-VM-per-context (4 UARTs share one VM). If we discover during
  Slice 3 that multiple panes on shared UARTs creates surprising shared
  state, revisit.
