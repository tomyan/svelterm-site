# Shell Demo Plan

Landing-page demo embedding a real Linux shell in a svelterm-rendered tmux-style
chrome. Shows off both the vt100 renderer (terminal-byte-stream → DOM) and
svelterm as a TUI framework in one shot.

## Architecture

- **v86** runs buildroot Linux in-browser, exposing up to four serial ports
  (serial0..serial3 via `uart1/uart2/uart3` flags). Each serial port is a
  separate getty inside the VM, so each pane is a real independent shell
  process.
- **@svelterm/vt100** renders each pane. The vt100 package is framework-level
  reusable code; the demo-specific wiring lives in svelterm-site only.
- **Tmux chrome** (pane splits, tabs, status bar, keybindings) is built *in
  svelterm*, rendered to the browser via @svelterm/core's browser target,
  dogfooding the framework.

## Shell limit

Maximum 4 shells (hardware limit of v86's 4 UARTs). Beyond that, the chrome
shows "demo limited to four shells" when a split/new-tab would exceed the
cap.

## Testing approach

TDD wherever logic is pure or testable in isolation. Manual browser validation
(via hubcap screenshots) for integration slices, with automated browser tests
added after if the slice's wiring turns out to be fragile.

## Iterations (elephant-carpaccio)

### Slice 1 — v86 + one vt100, no chrome

Goal: prove the byte pipeline end-to-end. A "Launch shell" button on the
landing page mounts a single `<VT100>` wired to v86's serial0 with a keystroke
listener routing back. User can `ls`, edit via vim, see output.

**Testable up front:**
- `keyEventToBytes(event)` — pure function, full unit coverage (arrows, F-keys,
  Ctrl-modifier combos, printable chars, IME/composition edge cases). Lives
  in @svelterm/vt100 since it's reusable.

**Manually validated:** v86 boot, serial wiring, container sizing.

**Tests to add after:** possibly a Playwright check that typing "echo hi\n"
produces "hi" in the rendered DOM.

### Slice 2 — svelterm tmux chrome, single pane

Goal: wrap the vt100 in a svelterm-rendered chrome (status bar showing tab
name + time, single pane border). No split/tabs logic yet. Validates the
svelterm-app → browser-target → embedded-vt100 composition.

**Testable up front:** status-bar formatting helpers (pad/truncate tab list),
clock tick reducer if any.

**Manually validated:** layout, borders, overall look.

### Slice 3 — split pane

Goal: `Ctrl-B %` (vertical split) and `Ctrl-B "` (horizontal split) divide
the current pane, launching ttyS1 with its own getty and `<VT100>`. Two real
shells in one v86.

**Testable up front:**
- Pane tree data structure (`split(tree, direction, paneId)`, `findPane`,
  `activePane`) — pure data.
- Keybinding dispatcher (`parseKeySequence(events)` — detects the `Ctrl-B`
  prefix then the next key).

**Manually validated:** actual split rendering, focus transitions, ttyS1 boot.

### Slice 4 — tabs

Goal: `Ctrl-B c` (new tab), `Ctrl-B n`/`p` (next/prev tab), `Ctrl-B <digit>`
(jump to tab). Each tab has its own pane tree. Tab bar in the status bar.

**Testable up front:** tab-list reducer (new/close/activate/navigate).

**Manually validated:** tab-bar rendering, state transitions under interactive
use.

### Slice 5 — polish

- Focus switching between panes (`Ctrl-B` arrow keys).
- Close pane (`Ctrl-B x`).
- 4-shell cap messaging.
- Styling pass: colours, status-bar content, pane-border focus indicator.

**Testable up front:** focus-navigation logic over pane tree, close-pane
reducer (adjacent pane gets focus, tab collapses if last pane closes).

**Manually validated:** visual polish, keyboard ergonomics.

## Decisions recorded

- Buildroot over Alpine: ~5–8MB vs ~25MB; fine for a landing-page demo.
- Lazy-loaded: v86 runtime and image only fetched when user clicks "Launch".
- Self-hosted assets (library via npm, image committed or fetched at build
  time): avoid third-party availability risk, can pin bytes.
- vt100 package gets `keyEventToBytes` since it's framework-level reusable.
  v86 glue stays in svelterm-site — demo only.
