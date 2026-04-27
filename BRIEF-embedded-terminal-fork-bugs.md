# Brief: embedded-terminal demo — investigate svelte-fork customRenderer bugs

## What this is

The embedded-terminal playground demo is half-built. The browser preview
works end-to-end (v86 boots, shell prompt visible, full output renders).
The terminal preview renders an empty cell grid — the Region component
never gets invoked. The cause appears to be one or more bugs in the
svelte-fork's `customRenderer` mode and/or its `experimental.async` mode.

The previous session got far enough to confirm the bugs are real, but
stopped before diving into the fork to fix them. **The user's intent is
to surface and fix these bugs upstream in the fork rather than work
around them, then ship a clean demo with top-level await.**

## Don't compromise

The demo's job is to teach "Svelte for the terminal". Per prior
conversation:

- **Top-level await stays.** No `$state` + `$effect.pre` workaround.
- **Dispatch is visible in the example.** No per-target import-resolution
  magic in the playground rewriter; the `await import('...Region')` vs
  `await import('...Dom')` branch must read from the example source.
- **`isTerminal()` API stays.** The user picked this name; do not revert
  to `useRenderTarget()`.
- **One renderer abstraction.** Reusable cross-target components (vt100's
  EmbeddedTerminal split) is the architectural goal — this isn't going
  away.

If a fork bug looks too deep to fix in this session, document it
precisely (file, line, repro, hypothesis) so the user can decide; do not
silently fall back to a workaround.

## Read first, in this order

1. `/Users/tom/projects/svelterm-site/PLAN-embedded-terminal-demo.md` —
   overall plan, slices, design decisions. Source of truth.
2. `/Users/tom/.claude/projects/-Users-tom-projects-svelterm/memory/embedded-terminal-demo.md` —
   slice progress as of 2026-04-27 (out of date for slice 3 — see below).
3. `/Users/tom/.claude/projects/-Users-tom-projects-svelterm/memory/svelterm-architecture.md` —
   stateless renderer model, IO abstraction.

## State on disk (none of this is pushed)

**svelterm** (`/Users/tom/projects/svelterm/`):

- HEAD `12c06bb` — adds svt-region primitive (slice 1, was `ee7fa03`).
- Working tree adds `isTerminal()` named export to `src/renderer/default.ts`,
  built into `dist/`. **Uncommitted.**

**svelterm-vt100** (`/Users/tom/projects/svelterm-vt100/`):

- HEAD `321735e` — adds EmbeddedTerminal + TerminalStream (slice 2 commit,
  was `4336af7`). The original `EmbeddedTerminal.svelte` from this commit
  has since been deleted on disk and replaced with two siblings:
  - `src/EmbeddedTerminalDom.svelte` — DOM-only path (uses TerminalView).
    Compiles fine via vite-plugin-svelte default.
  - `src/EmbeddedTerminalRegion.svelte` — svelterm-only path (renders
    `<svt-region>`). Uses `use:captureRegion` action to get the node ref
    because `bind:this` is blocked in customRenderer mode.
- `package.json` exports the two new subpaths; old `EmbeddedTerminal`
  subpath removed. **All uncommitted.**

**svelterm-site** (`/Users/tom/projects/svelterm-site/`):

- HEAD `3ee32b4` — Shell.svelte → EmbeddedTerminal migration (slice 2
  commit, was `9d1fafa`). Working tree contains the slice 3 work:
  - `src/lib/v86-stream.ts` — factory of v86Stream factories (per-context
    VM isolation, refcounted destroy).
  - `src/lib/embedded-terminal-region-loader.ts` — runtime-compiles
    `EmbeddedTerminalRegion.svelte` with `customRenderer: '@svelterm/core'`,
    rewrites svelte+core+relative imports to runtime references, returns
    the component via blob URL dynamic import.
  - `src/lib/worker/compiler.ts` — adds TS preprocess via
    `ts.transpileModule` and `experimental: { async: true }` for both
    compile passes.
  - `src/lib/svelterm-runtime.js` — re-exports module namespaces:
    `sveltermCore` (for isTerminal + default renderer), `sveltermVt100`
    (Terminal + Attr for Region's relative imports), plus the v86 factory
    builder and Region loader.
  - `src/lib/TerminalPreview.svelte` — load order is now: import runtime,
    seed `__svelterm_terminal_modules__`, await Region compile (writes
    back into the same map), then publish `sveltermRuntime` so
    mountTerminalComponent can fire. Rewriter handles named-import of
    `@svelterm/core` (for `isTerminal`) and dynamic imports of vt100's
    Region/Dom subpaths.
  - `src/lib/BrowserPreview.svelte` — symmetric rewrite, also clones
    `<style data-vite-dev-id>` from parent into iframe head so vt100's
    scoped CSS reaches the iframe.
  - `src/lib/Shell.svelte` — imports `EmbeddedTerminalDom` (was
    `EmbeddedTerminal`).
  - `src/lib/examples/embedded-terminal.txt` — TS, dynamic-import
    dispatch on `isTerminal()`, currently in `$state` + `$effect.pre`
    form (because top-level-await form also failed).
  - `src/lib/examples/index.ts` — embedded-terminal sorted first.
  - **All uncommitted.** Dev server typically running on
    `http://localhost:5173/`.

## The bug the next session is hunting

`isTerminal()` returns `true` (verified). The `await Promise.resolve({ default: ... })`
dispatches to Region successfully. `$.set(EmbeddedTerminal, mod.default, true)`
runs — but the `{#if EmbeddedTerminal}` block never re-renders, so
EmbeddedTerminalRegion is never invoked. No console errors.

The compiled example (terminal-target) looks like:

```js
let EmbeddedTerminal = $.state(null);

$.user_pre_effect(async () => {
    const mod = isTerminal()
        ? await Promise.resolve({ default: window.__svelterm_terminal_modules__.embeddedTerminalRegion })
        : await Promise.reject(new Error("..."));
    $.set(EmbeddedTerminal, mod.default, true);
});

// ...

$.if(node, ($$render) => {
    if ($.get(EmbeddedTerminal)) $$render(consequent);
});
```

`window.__svelterm_terminal_modules__.embeddedTerminalRegion` is a
function (verified via `wrapped` probe — invocation count stays 0).
`$.if` should re-evaluate when state changes — it doesn't.

This needs reproducing inside the svelte-fork's test surface to nail
down whether the bug is in:

- `customRenderer` mode's `$.if` evaluator,
- `customRenderer` mode's `$.set` propagation,
- the interaction between the `customRenderer` mode and `experimental.async`
  (`$.user_pre_effect` is the async-rune form), or
- something in the playground's compiled-blob loader.

Earlier the same demo with top-level await (the `experimental.async`
template-form using `$.run`/`$.async`) also failed — but at the time
there was an unrelated module-map race. Worth retrying top-level-await
form *now* that the race is fixed; if it still fails, that's a separate
async-rune bug.

## Cumulative customRenderer incompatibilities found

Useful to write up as a known-issues list for the fork. Each is a real
limitation that surfaced building this demo.

1. **`css: 'injected'` is rejected.** Error:
   `\`css: 'injected'\` is not compatible with \`customRenderer\``. Source:
   `/Users/tom/projects/svelte-fork/packages/svelte/src/compiler/phases/2-analyze/index.js:473`
   and `phases/1-parse/read/options.js:205`. Documented; not necessarily
   wrong, but worth understanding *why*.
2. **`bind:` on elements is rejected.** Error:
   `\`bind:\` is not compatible with \`customRenderer\``. Source:
   `phases/2-analyze/visitors/BindDirective.js:31`. Workaround in this
   demo: `use:` action to capture the node — `use:` IS allowed
   (`UseDirective.js` does no custom_renderer check). The blanket bind
   block looks too aggressive for `bind:this` specifically.
3. **`$.without_renderer` wraps imported component invocations**, so a
   reusable cross-target component compiled with the default DOM renderer
   ends up rendering DOM nodes (its `<svt-region>` becomes a DOM element,
   not a SvtRegionNode). Source:
   `phases/3-transform/client/visitors/shared/component.js:462`. Workaround
   in this demo: pre-compile the Region variant with `customRenderer` so
   its body re-pushes the svelterm renderer; the wrapping `without_renderer`
   at the call site doesn't matter once the body pushes back.
4. **Reactive `{#if}` doesn't re-evaluate after async `$.set`** in
   customRenderer mode — what's blocking us right now. No explicit error.
   Need a minimal repro inside the fork's test suite.

## Check upstream first — many fixes have landed

The svelte-fork is checked out on branch `svelte-custom-renderer`,
tracking `upstream/svelte-custom-renderer`
(`https://github.com/sveltejs/svelte.git`). As of writing this brief,
local HEAD is `a327b1c1c` and upstream HEAD is `d333a7f0b` — **30+
unmerged upstream commits**, several of which look directly related to
the bugs we're hunting:

- `7be1a0247 fix: ensure proper HMR updates for dynamic components (#18079)`
  — could be #4 above (`{#if}` with dynamic component not re-rendering).
- `273f1a85a fix: keep flushing new eager effects (#18102)` —
  effect-flush behaviour, also potentially #4.
- `671fc2ea1 fix: never mark a child effect root as inert (#18111)` —
  effect lifecycle.
- `0e9e76f29 fix: freeze deriveds once their containing effects are destroyed (#17921)` —
  reactivity teardown.
- `b50bdde4b fix: HMR_ANCHOR use operations methods` — possibly relevant
  to without_renderer / renderer-method dispatch.
- `8e6d68c1d chore: move custom_renderer to state.js` plus
  `5c60dff58 chore: rename custom_renderer_imports`,
  `2a4af72fd chore: move Renderer type to .d.ts`,
  `a2ccdc4f4 chore: adhere to naming conventions` — refactoring of the
  customRenderer surface; line numbers in the catalog above will drift.

**Step 0 for the next session: rebase/merge upstream and retest before
doing anything else.** It's plausible some of the catalog items are
already fixed. Origin (`tomyan/svelte`) push may need an SSH key the
session doesn't have — just confirm with the user before pushing.

## Suggested approach for the next session

1. Read the plan + memory + this brief. Confirm the on-disk state
   matches what's described above (`git status` in all three repos +
   `ls /Users/tom/projects/svelterm-vt100/src/*.svelte`).
2. **Pull upstream svelte-fork** (see section above) and rebuild
   (`pnpm build` inside `packages/svelte`). Update svelterm-site's
   svelte if it's pinned via a path/version.
3. Start the dev server (`pnpm dev` in svelterm-site). Open the
   playground; embedded-terminal is the default example. Verify browser
   preview works, check terminal preview — re-test whether #4 still
   reproduces after the upstream pull.
4. **Get the cumulative incompatibilities catalog into a more durable
   place** — either an issue list under `/Users/tom/projects/svelte-fork/`
   or a section in svelterm's `DESIGN.md`. The user will want to
   reference these regardless of which they end up fixing. Re-validate
   each entry after the upstream pull (line numbers will drift; some may
   no longer reproduce).
5. For any bug still reproducing, build a minimal repro inside
   `svelte-fork/packages/svelte/test/` — fewest moving parts. This will
   reveal whether the problem is in reactivity, async, customRenderer
   internals, or an interaction.
6. Decide per-bug: fix upstream (preferred, file a PR / branch on the
   fork), or refactor the demo to avoid it without compromising the
   principles above.
7. Final state: terminal preview shows the same v86 shell prompt as the
   browser preview, example uses top-level await with a single line of
   dispatch, no `$state`/`$effect.pre` scaffolding.

## Don't

- Don't `git push` anything — the user explicitly said work locally.
- Don't add `$effect.pre` or `$state` workarounds to the example as the
  final solution; that's the failed compromise.
- Don't move dispatch into the playground rewriter (per-target import
  resolution); the user explicitly chose visibility in the example.
- Don't delete `BRIEF-embedded-terminal-fork-bugs.md` until the user
  confirms — they may want to amend it.

## Memory update needed at end of session

`/Users/tom/.claude/projects/-Users-tom-projects-svelterm/memory/embedded-terminal-demo.md`
needs slice 3 marked done (or its status accurately recorded), with a
pointer to fixes landed in the fork.
