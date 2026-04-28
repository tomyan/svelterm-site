# Brief: embedded-terminal demo — four remaining issues

The demo renders end-to-end in both previews from a separate-origin
iframe substrate. The parent's theme toggle, CSS-edit live updates,
and the iframe vite dep cache are all wired correctly. Four follow-up
issues remain — none are blockers, but they're the shortlist before
this can be the landing demo. Each can be tackled independently.

## Read first, in this order

1. `/Users/tom/projects/svelterm-site/PLAN-embedded-terminal-demo.md` —
   overall plan, slices, design decisions. Source of truth.
2. `/Users/tom/.claude/projects/-Users-tom-projects-svelterm/memory/embedded-terminal-demo.md` —
   slice progress and where the previous session(s) ended up.
3. `git log` in `svelterm`, `svelterm-vt100`, `svelterm-site` —
   the recent commits explain *why* each fix was made.

## State on disk (all committed, none pushed)

- **svelterm** `3353219` — `RunOptions.colorScheme` override skips
  OSC 11 polling when the host pins a scheme (used by the browser
  preview's terminal-mode).
- **svelterm-vt100** `56f443b` — `Attr` is a non-const enum,
  `Terminal.resize/constructor` throw on non-positive dims.
- **svelterm-site** `2fb7c8a` — slice 5a iframe substrate, slice 5b
  theme propagation, vite cacheDir split, CSS-edit live update fix
  via content-based cssHash + style sweep, counter example restyled
  to match terminal.
- **svelte-fork** `08575d17e` — merged upstream/svelte-custom-renderer
  (was 48 commits behind).

User has not pushed anything; do not push without confirmation. User
plans to rewrite commit times before pushing, so commit messages
should be self-contained and not assume current ordering.

## The four issues — recommended order

The substrate work (slice 5a) and theme propagation (slice 5b, brief
#6) are done. The remaining issues are all "wire this once in the
iframe runtime" rather than "implement twice across two harnesses".

**Do #4 whenever** — v86 mount-failure flake is orthogonal to the
harness. Pick it up alongside any of the others.

The numbering below reflects how the issues were originally surfaced.

### 1. Padding parity, and a clipping bug

The two previews should have a similar amount of padding around the
embedded terminal — currently the example uses
`padding: 8px` for browser and `padding: 0` in the
`@media (display-mode: terminal)` override.

There's a bug to chase while you're in there: with `padding: 0` in the
example's `.shell`, the **browser** preview happily shows the content
flush to the wrapper edge, but the **terminal** preview clips the
leftmost column. So:

- The terminal preview is missing one cell of horizontal slop somewhere
  — possibly in `<svt-region>`'s box, in the example's `.shell` flow,
  or in svelterm's CSS `box-sizing`/inset handling.
- Reproduce by removing the `@media (display-mode: terminal)` override
  in the example and observing both. Or just by setting both paths to
  `padding: 0` and noting the asymmetry.

Fix: settle on a small padding for both (or none for both), and find
the off-by-one that's eating the leftmost column on the svelterm side.

### 2. Resize semantics — fixed cells + propagate to the shell

Right now, when you zoom the playground or resize the window, the
**browser** preview can show a partial character in the last column
(pixel widths don't divide cleanly into char widths). The terminal
preview snaps to whole cells already — that's the right behaviour.

The rest of the chain is missing: the embedded terminal should be a
fixed grid of *cols × rows*, and size changes should propagate to the
running process via the standard SIGWINCH/escape sequence path so the
shell reflows. v86 exposes this for serial via `serial0-resize` (or
similar — verify against the v86 API surface) — `TerminalStream.resize`
exists in the interface but currently no-ops in `v86Stream` because
"v86 serial console has no window-size channel" (see comment).

That comment may have been wrong, or a different channel may be
appropriate. Worth checking what v86 actually exposes — the contract
on `TerminalStream` is the right shape, just the v86 implementation
needs a real resize path.

End state: pull the playground's preview-screen edge, watch the shell
prompt reflow.

### 3. Focus + keyboard routing

- The terminal preview can't be focused at all right now (no `tabindex`,
  no key handler on the visible TerminalView wrapper from svelterm).
- The browser preview can be focused and keystrokes reach the embedded
  shell — but the visible cursor is stuck at the iframe's top-left,
  even though typed content lands in the right place. So the *visual*
  cursor isn't tracking v86's cursor.
- We want a subtle focus indicator on whichever demo is active, and
  that demo gets the keyboard events. Probably an outline ring or
  border tint on the focused preview-panel.

Two halves:
- Wire the terminal preview to receive focus and forward keys to the
  example's stream. svelterm input → keyEventToBytes → stream.write
  is the same shape vt100's `EmbeddedTerminalDom` already does for the
  browser; the svelterm path needs an equivalent.
- Fix the cursor display on the browser side. Likely TerminalView's
  cursor positioning isn't being updated, or the wrong terminal's
  cursor is being rendered.

### 4. v86 mount-failure flakiness

`mount: mounting host9p on /mnt failed: Device or resource busy` is
the first line of the boot output we see. It looks flaky (the demo
still works without it, but the line shouldn't be there in the
finished demo).

Check the v86 init args (`iframe/src/v86-stream.ts`): the
`filesystem: {}` config or some race in our setup is probably
provoking the mount attempt before host9p is ready. Either remove the
filesystem mount entirely (we don't use it for the shell demo) or
serialise the boot so it doesn't race.

## What's done since the previous brief

- **#5 (iframe + origin isolation)** — slice 5a, `5459fd4`. Both
  previews are cross-origin iframes from `iframe/` (127.0.0.1:5174 in
  dev, planned svelterm-untrusted.net in prod). postMessage protocol
  in `iframe/src/protocol.ts`.
- **#6 (theme propagation)** — slice 5b, `118607d`. Parent posts
  theme messages, iframe drives `<html data-theme>` + explicit
  `color-scheme`. svelterm gained `RunOptions.colorScheme` so the
  terminal preview can pin the scheme without OSC polling. User CSS
  `@media (prefers-color-scheme: x)` rules are duplicated under
  `:root[data-theme="x"]` by the iframe runtime.
- **Iframe vite cacheDir collision** — `dd94b40`. Both vite servers
  shared `node_modules/.vite/deps`; parent's run dropped the iframe's
  v86 bundle and dynamic imports 404'd. Iframe now uses
  `node_modules/.vite-iframe`.
- **CSS-edit live update regression** — `fe6b3d1`. Slice 5a's
  persistent iframe regressed live CSS updates because Svelte's
  default `cssHash` hashes the filename, so `append_styles()`'s
  dedup-by-hash skipped each new style. Worker now passes a custom
  `cssHash` over CSS content; iframe sweeps stale
  `style[id^="svelte-"]` to keep head bounded.
- **Counter example styling** — `2fb7c8a`. Browser preview now uses
  monospace + matched margin/padding/units so it reads as a
  translation of the terminal version, with `background: transparent`
  on buttons.

## Standing customRenderer caveats (still real, not blocking)

- `css: 'injected'` is rejected in customRenderer (in
  `phases/2-analyze/index.js`). We use `css: 'external'` for the
  terminal compile and `css: 'injected'` for the browser compile.
- `bind:` on elements is rejected in customRenderer; work around with
  `use:` actions.
- `without_renderer` wraps imported component invocations; the
  precompile-with-customRenderer trick still applies (the Region's
  body re-pushes the svelterm renderer at function entry).

## Don't

- Don't `git push` without explicit user confirmation — work locally.
- Don't roll back top-level await as the dispatch shape. It works, and
  it's the teaching point.
- Don't move dispatch into the playground rewriter (per-target import
  resolution); the user explicitly chose visibility in the example.
- Don't delete this brief or `PLAN-embedded-terminal-demo.md` until
  the user confirms.

## Memory update needed at end of session

`/Users/tom/.claude/projects/-Users-tom-projects-svelterm/memory/embedded-terminal-demo.md`
already records the slice 5b completion. Update it with whichever of
#1–#4 you tackle, the resulting commit hash, and any newly discovered
caveats.
