# Svelterm Site Plan

## Content architecture

Reference documentation lives as markdown in the svelterm repo
(`docs/`), not in this site repo. The site pulls it in at build time,
similar to the hubcap site. This keeps docs co-located with the code
they describe and avoids drift.

The site itself owns the landing page, broader structure, navigation,
and interactive components (editor, live rendering).

## Landing page

The page leads with the core value proposition: **one Svelte component,
real HTML and CSS, renders to both web and terminal.**

### Hero: live editor with dual rendering

- Code editor showing an example `.svelte` component
- Side-by-side (or stacked) live rendering to both:
  - **Web** — standard browser rendering of the same component
  - **Terminal** — real VT100 emulator displaying svelterm's ANSI output
- Ability to load other example components (counter, todo, theming,
  dual-target, etc.)
- Editing the component updates both renderings live

### Below the fold: terminal CSS overview

High-level reference for the things that are different in terminal CSS:

- **Media queries** — `@media (display-mode: terminal)` and
  `@media (display-mode: screen)` for target-specific rules,
  `@media (prefers-color-scheme: dark/light)` with terminal detection
- **Border styles** — `single`, `double`, `rounded`, `heavy` using
  box-drawing characters
- **Units** — `cell` maps to terminal cells (monospace character
  positions)
- **Colors** — ANSI named colors, 256-color palette, truecolor hex,
  all 148 CSS named colors
- **Opacity** — `opacity: dim` uses the terminal dim attribute
- **Pseudo-classes** — `:focus` and `:hover` work via keyboard
  navigation and mouse

## Package architecture

### svelterm

Core renderer, CSS engine, layout, input handling. Owns the IO
abstraction that decouples svelterm from a specific terminal:

- **IO interface** — svelterm writes ANSI bytes and reads input bytes
  through an abstract interface
- **Passthrough adapter** — current behaviour, writes to process
  stdout/stdin
- **In-process adapter** — connects to a JS-side consumer (e.g. a
  VT100 emulator running in the same context)

### svelterm-vt100

VT100 state machine that interprets ANSI escape sequences into a cell
grid. No opinion on rendering — it manages terminal state (cells,
cursor, scrollback, attributes) and exposes the grid for consumers to
render however they want.

Shared by:
- **svelterm-site** — renders the cell grid to DOM for the live
  terminal preview
- **svelterm-ui** — renders the cell grid to svelterm's own cell
  buffer for an embedded terminal pane component

### svelterm-ui

Higher-level components built on svelterm: dialog, tabs, progress bar,
fuzzy picker, embedded terminal pane, etc. The embedded terminal
component uses svelterm-vt100 to interpret ANSI and renders the result
into svelterm's cell grid.

### svelterm-site (this repo)

The website. Imports svelterm-vt100, wraps it in a DOM-rendering
component for the live editor's terminal preview. Pulls reference
docs from the svelterm repo at build time.

## Existing content in svelterm repo

The svelterm repo already has docs at `docs/`:
- `guide/css.md` — CSS features
- `guide/layout.md` — layout system
- `guide/input.md` — input handling
- `guide/theming.md` — theming with CSS variables
- `debug/svt.md` — debug protocol
- `reference/` — empty, to be populated

## Slices

### Slice 1: Docs pipeline

Set up build-time ingestion of markdown from the svelterm repo's `docs/`
directory. Render as pages under `/docs/` or `/guide/` on the site.

### Slice 2: IO abstraction in svelterm

Define the IO interface in svelterm that abstracts over terminal
output/input. Two adapters:
- **Passthrough** — current behaviour, writes to process stdout/stdin
- **In-process** — connects to a JS-side consumer

This lives in the svelterm repo.

### Slice 3: svelterm-vt100 package

Build the VT100 state machine: ANSI parser, cell grid, cursor
management, SGR attributes, alternate screen buffer. No rendering —
just state.

### Slice 4: Browser terminal preview

In the site, build a component that takes a svelterm-vt100 instance
and renders its cell grid to DOM. Wire it up with the in-process IO
adapter so svelterm output flows through.

### Slice 5: Live editor with dual rendering

Build the hero component: code editor + web preview + terminal preview.
Wire up live compilation and rendering of the edited component to both
targets.

### Slice 6: Example loader

Add a set of example components that can be loaded into the editor.
Source these from the svelterm repo's demo directory.

### Slice 7: Terminal CSS reference section

Build out the below-the-fold content covering media queries, border
styles, units, colors, opacity, and pseudo-classes with inline examples.

### Slice 8: Navigation and docs pages

Add site navigation, render the ingested markdown docs as pages, connect
everything together.
