# Brief: track down infinite reactive loop in `TerminalPreview.svelte`

## Context

We're refactoring `@svelterm/vt100` so the package ships a single reactive
Svelte component (`TerminalView.svelte`) rather than the previous
imperative `TerminalRenderer` class plus thin Svelte wrapper. The
package's design (see `/Users/tom/projects/svelterm-vt100/DESIGN.md`) is
that `TerminalView` works in both browser DOM and svelterm-rendered
targets from the same source, with feature parity to the old imperative
renderer (including CSS-gradient block-glyph rendering, cursor overlay,
SGR attrs, fontFamily/fontSize/lineHeight options).

The mid-term goal is `TerminalStream` + `EmbeddedTerminal` + a PTY adapter
so tmux-style apps can be built on this primitive — see DESIGN.md.

The site's `TerminalPreview.svelte` was previously importing
`TerminalRenderer` from the deleted `@svelterm/vt100/dom` subpath. It's
now been migrated to use `<TerminalView>` instead. **Migration introduced
an infinite reactive loop — Chrome's renderer process pegs at 99% CPU.**

## Symptoms

- Open `http://localhost:5173/` (the landing page).
- `TerminalPreview.svelte` mounts as part of the playground, which compiles
  and runs an example component (e.g. counter) inside an `InProcessIO`.
- Page never settles. Chrome's renderer goes to ~99% CPU and stays there.
- Hubcap commands timeout because the page is unresponsive.
- Killing the renderer (`kill -9 <renderer-pid>`) is the only way out.

The Shell demo (lazy-loaded via the "Launch shell" button) uses the same
`TerminalView` and works correctly, so the bug is specific to the
TerminalPreview ↔ TerminalView combination — most likely how the
playground's compiled svelterm component drives the IO/Terminal that
TerminalView is rendering.

## Files in play

- `/Users/tom/projects/svelterm-vt100/src/TerminalView.svelte` — new
  reactive component. Subscribes to `terminal.onChange`, bumps `version`
  ($state), `rows` and `cursor` are `$derived.by` and read `void version`
  before reading the grid.
- `/Users/tom/projects/svelterm-vt100/src/terminal.ts` — calls
  `this.onChange?.()` at the end of `write()` and `resize()`.
- `/Users/tom/projects/svelterm-site/src/lib/TerminalPreview.svelte` —
  the migrated container. Creates a `Terminal`, sets `onResponse` to feed
  the IO, renders `<TerminalView terminal={terminal} ...>`.
- `/Users/tom/projects/svelterm-site/src/lib/svelterm-runtime.js` —
  loads svelterm runtime + `InProcessIO`.

## What changed in the migration

1. Replaced `TerminalRenderer` constructor + `renderer.dispose/render/scheduleRender`
   with `<TerminalView>` rendered inside the existing `.terminal-container`.
2. `terminal` and the colour props are `$state` so reactive changes propagate.
3. The theme effect now updates `foreground`/`background` props instead of
   reconstructing a renderer.
4. `mountTerminalComponent` no longer calls `renderer.render()` — it relies
   on `TerminalView` reactively re-rendering when the terminal changes.

The old code wrote to `terminal` then *manually* called `renderer.render()`
or `renderer.scheduleRender()` after each write. New code expects the
view to re-render automatically through `terminal.onChange` → version
bump → `$derived` re-evaluation.

## Hypotheses (not yet verified)

1. **Cycle through `onResponse`.** Terminal sees a query → fires
   `onResponse` → IO feeds it back to svelterm → svelterm writes a
   response → terminal mutates → `onChange` fires → `$derived` re-reads
   cells → reactive scheduler re-runs effects → something writes to
   the terminal again. If the running example or the InProcessIO is
   echoing its own output back, you'd get a tight loop.

2. **`terminal.cursor` getter as part of `$derived` triggers a write.**
   Unlikely — it's a simple getter — but worth verifying it doesn't have
   side effects, and that `$derived.by(() => { void version; return terminal.cursor })`
   doesn't capture the wrong reactive dep. Could try snapshotting the
   cursor properties (`{ col, row, visible }`) into a fresh object inside
   the derived to be safe.

3. **`onChange` chained wrongly.** TerminalView sets
   `terminal.onChange = () => { version++; previous?.() }`. If the
   previous handler was written by another consumer that also bumps
   reactive state, you could get stacked calls. Check whether anything
   else assigns `onChange` (probably nothing — TerminalPreview only sets
   `onResponse`).

4. **Reactive prop change feeds back into terminal.** `foreground` /
   `background` props update on theme effect → TerminalView re-renders →
   nothing should write back to terminal. Probably not it, but verify.

5. **Svelte's microtask scheduling re-running the $effect that calls
   `mountTerminalComponent`.** If something causes
   `terminalJs`/`terminalCss` to look "new" each tick, that effect would
   recompile and remount the example component continuously. Check the
   $effect dependencies in TerminalPreview.

## Investigation steps

1. **Reproduce the hang in isolation.** Comment out the
   `mountTerminalComponent` call in TerminalPreview's $effect and see if
   the page stabilises. If yes — the loop is driven by the playground
   example writing back through the IO. If no — it's in TerminalView's
   reactivity itself.

2. **Add a counter to `terminal.onChange`.** Print or stash on `window`
   how many onChange fires per second. If thousands per second, confirms
   the loop is at the terminal-write level. If single-digit, the loop is
   in Svelte's render cycle.

3. **Profile via Chrome DevTools.** Disable JIT for v86 isn't relevant
   here; just open Performance, record a few seconds of the hang, see
   what's calling what. Look for repeated `Terminal.write`, repeated
   `$derived` recomputation, or repeated `mount`/`unmount` of an example
   component.

4. **Test with the simplest example.** Force the playground to use
   `counter.txt` (smallest example). If counter still hangs, the bug is
   not example-specific.

5. **Compare to working Shell flow.** The Shell demo's `TerminalView`
   path works fine. The difference: Shell drives writes from v86 serial
   output (one direction); TerminalPreview drives writes from a svelterm
   app *and* feeds back through `onResponse`. If you bypass `onResponse`
   (set it to a no-op), does the hang go away?

## Likely fix shape

If hypothesis 1 is right (response cycle), the fix is to ensure terminal
output that originates from `onResponse` doesn't re-trigger `onChange` →
re-render → re-input. Could be:

- Throttle/coalesce `onChange` to one-per-frame (svelte's flush).
- Make `mountTerminalComponent` idempotent w.r.t. its $effect deps so it
  doesn't remount on every write.
- Drop the unconditional `onChange?.()` call in `Terminal.write` in
  favour of a "if dirty rows changed, fire onChange" guard so empty
  parser feeds (e.g. response queries that don't mutate cells) don't
  bump version.

## Fallback plan

If tracking it down takes more than ~90 minutes, revert TerminalPreview
to use the imperative renderer:

1. Restore `/Users/tom/projects/svelterm-vt100/src/dom.ts` from git
2. Restore `/Users/tom/projects/svelterm-vt100/src/dom-style.ts` and
   `test/dom-style.test.ts` from git
3. Add the `./dom` export back to `package.json`
4. Re-export `TerminalRenderer` from `src/index.ts`
5. Revert `TerminalPreview.svelte`

But — keep the new reactive `TerminalView` in place; Shell.svelte uses it
and we'll want it for `EmbeddedTerminal` later. Just acknowledge the
implementation duplication in `DESIGN.md` (one Svelte component, one
imperative class — not exposed publicly) and move on to the bigger
design pieces (`TerminalStream` + `EmbeddedTerminal` + PTY adapter).

## Where I left off

- Last working state: the `Shell.svelte` landing page demo at
  `http://localhost:5173/` after clicking "Launch shell". Renders a
  buildroot Linux through the new reactive TerminalView. Confirmed.
- Broken state: visiting the landing page itself (which mounts
  TerminalPreview via the playground) hangs the renderer.
- The vite dev server is still running on `:5173`, log at
  `/tmp/vite-out.log`.
- Tests at `/Users/tom/projects/svelterm-vt100`: `npm test` passes, 197
  tests, 0 failures.

## Pairing context

The user explicitly directed: no duplication, no backwards-compat, keep
it clean. They also asked for **feature parity** when we discussed
porting block-glyph rendering. That's why we ported instead of reverting.
They're aware the migration is in flight and have approved this brief —
so don't unilaterally pivot to the fallback unless the time budget runs
out.

## Branch / git state

Working directory: `/Users/tom/projects/svelterm` (note this is the
**svelterm** repo, but most current work is in two adjacent siblings:
`svelterm-vt100/` and `svelterm-site/`). Each is its own git repo. None
of this work is committed yet — your call after fixing whether to commit
in slices or one go. Slice 1 of the shell demo (everything before this
refactor) was working and committed-worthy before; the current repo has
an uncommitted mix of the design refactor and the migration.
