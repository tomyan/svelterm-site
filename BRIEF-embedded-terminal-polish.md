# Brief: embedded-terminal demo — six remaining issues

The slice 3 demo now renders end-to-end in both previews using top-level
await. Six follow-up issues remain — none are blockers, but they're the
shortlist before this can be the landing demo. Each can be tackled
independently.

## Read first, in this order

1. `/Users/tom/projects/svelterm-site/PLAN-embedded-terminal-demo.md` —
   overall plan, slices, design decisions. Source of truth.
2. `/Users/tom/.claude/projects/-Users-tom-projects-svelterm/memory/embedded-terminal-demo.md` —
   slice progress and where the previous session(s) ended up.
3. `git log` in `svelterm`, `svelterm-vt100`, `svelterm-site` —
   the recent commits explain *why* each fix was made.

## State on disk (all committed, none pushed)

- **svelterm** `0c125c8` — svt-region fill primitive, console gating,
  Renderer type drop, SvtRegionNode.markDirty.
- **svelterm-vt100** `56f443b` — `Attr` is now a non-const enum,
  Terminal.resize/constructor throw on non-positive dims.
- **svelterm-site** `aa68841` — TLA example, svelte-public-API
  rewrites in both previews + region loader, iframe body height
  chain, Playground sizing bail-out.
- **svelte-fork** `08575d17e` — merged upstream/svelte-custom-renderer
  (was 48 commits behind).

User has not pushed anything; do not push without confirmation.

## The six issues — recommended order

**Do #5 (iframe + origin isolation) first.** It's the biggest single
piece of work but it's the substrate that #1, #2, #3, #6 all build
on — once both previews are iframes with a uniform postMessage
channel, those four become "wire this once in the runtime" rather
than "implement twice across two divergent harnesses". The "smallest
blast radius first" instinct is wrong here.

**Do #4 whenever** — v86 mount-failure flake is orthogonal to the
harness. Pick it up alongside any of the others.

**Then #1, #2, #3, #6 fall out cleanly on the new substrate:**
padding lives in the iframe template; resize is one
SIGWINCH-equivalent channel both previews call; focus is a single
ring + one keyboard postMessage path; theme is one postMessage on
theme change.

The numbering below reflects how they were originally surfaced, not
the order to tackle them.

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

Check the v86 init args (`/Users/tom/projects/svelterm-site/src/lib/v86-stream.ts`):
the `filesystem: {}` config or some race in our setup is probably
provoking the mount attempt before host9p is ready. Either remove the
filesystem mount entirely (we don't use it for the shell demo) or
serialise the boot so it doesn't race.

### 5. Iframe both previews; separate origin

Right now the **terminal** preview compiles user code and evaluates it
in the **main page's JS context** — which means a malicious example
could touch the playground state or anything else on the page. The
browser preview already runs in a same-origin iframe via `srcdoc`.

Two changes:
- Run the terminal preview in its own iframe too, the same way the
  browser preview does. The compiled blob+postMessage handoff should
  port without much friction.
- Move both iframes to a separate origin so user code can't read or
  mutate the parent's window. The standard pattern is a different
  subdomain with its own bundle of the runtime, served from
  `playground.svelterm.dev` (or `[hash].svelterm.dev` per-demo for
  full isolation). Alternative: a sandboxed iframe with the
  `allow-scripts` token but *not* `allow-same-origin` — that gives
  origin isolation without DNS work.

Side effect of doing this: today the iframe inherits a bunch of styles
from the parent (vite-plugin-svelte's scoped style elements are cloned
in for vt100). With a separate origin you can no longer reach across,
so the runtime needs to bundle whatever CSS it actually needs and ship
it as part of the iframe's own document. **This is the natural moment
to level the styling between the two previews** — they should look
identical in terms of typography, padding, etc.

### 6. Browser preview ignores light theme

When the playground is set to light mode, the browser preview stays
dark. The terminal preview honours the theme.

The iframe gets parent-document `<style data-vite-dev-id>` cloned in
once at mount time (see `BrowserPreview.svelte` `iframeHtml()` and the
mount handler). Theme changes on the parent don't reach the iframe
because (a) the iframe's `:root` color-scheme block is hardcoded with
`@media (prefers-color-scheme: light)` rather than driven by the
parent's `theme.svelte.js`, and (b) we don't re-clone or update the
cloned styles on theme change.

Fix: drive the iframe's theme from a postMessage on theme change, or
expose the theme as a CSS variable on the iframe's `<html>` and have
the iframe respect it directly. (Issue #5 will likely change how the
iframe is built; pick whichever fits the new model.)

## What's *not* an issue any more — things the previous brief was wrong about

- **`{#if EmbeddedTerminal}` doesn't re-evaluate after async `$.set`** —
  not a customRenderer bug. It works fine post-merge. The example was
  failing because of `onDestroy` rewrite + `Attr` const-enum erasure.
- **`css: 'injected'` is rejected in customRenderer** — still true,
  still in `phases/2-analyze/index.js`. Not blocking us; we use
  `css: 'external'` everywhere.
- **`bind:` on elements is rejected in customRenderer** — still true;
  we work around with `use:` actions where needed.
- **`without_renderer` wraps imported component invocations** — still
  true; the precompile-with-customRenderer trick still applies (the
  Region's body re-pushes the svelterm renderer at function entry).

So the catalog of customRenderer incompatibilities still has those
three real entries, but they're not what blocks the demo today.

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
already records "slice 3 committed and rendering". Update it with the
six issues above as the next punch list, and clear stale references to
the customRenderer-`{#if}` hypothesis (which is no longer in play).
