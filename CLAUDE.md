# LetterMyComic — project instructions

## Joined word balloons (do not regress)

- Connecting bubbles have **open connectors**: the band between two joined
  balloons must be open into BOTH balloons — no outline stroke may cross
  either junction. The band's interior is continuous with both balloon
  interiors (like hand-inked comic lettering, e.g. Comic Life 3).
- The connector's two edges are **relatively parallel** — a wide band, never
  a wedge that comes to a point at either balloon.
- Implementation: the connector is a separate open-ended band
  (`bandFill`/`bandEdges` from `balloonGeom`) painted AFTER both balloon
  bodies — fill covers the outline crossings, stroke only along the two
  sides. It is NOT spliced into either balloon's outline path.
- The parent balloon ALWAYS keeps its own pointed speaker tail pointing at
  the character — even when a joined child sits in the same direction. The
  connecting band is the same fill colour and tucks under the partner's
  outline, so it reads as falling BEHIND the parent's tail. Do NOT hide the
  parent tail when the child lines up with it (that made the tail vanish
  mid-drag — a reported regression).
- When joined balloons overlap they melt into one shape and the connector
  disappears; separating them brings the band back with a clean straight
  default (stale bend points must never fling or collapse the band).

## Code organization

- **No source file may exceed 1500 lines.** When a file grows past 1500
  lines, refactor it: split it into multiple focused, linked subfiles
  (e.g. a directory of modules re-exported from the original path). Apply
  this to any file you touch that is already over the limit.

## Every entry point for a behaviour

- When fixing or changing a piece of editor functionality, find EVERY UI
  entry point that triggers it and fix them all: the same action commonly
  exists as a sidebar button, a toolbar `ToolBtn`, a menu-bar entry
  (`renderMenuBar` in `chromeBars.tsx`), a context-menu item
  (`dialogs.tsx`) and/or a keyboard shortcut (`Editor.tsx`). Grep for the
  label and for the underlying op before calling a fix done — a "+ Page"
  fix that misses the toolbar's "New Page" button ships half-broken.
  Prefer routing every entry point through ONE shared op/handler so they
  cannot drift apart again.

## Editor/export parity

- The DOM editor and the canvas/PDF export must stay WYSIWYG: any change to
  text layout (line height, tracking, runs, warp, crossbar-I) or balloon
  geometry must be applied to BOTH `src/components/Editor*` rendering and
  `src/lib/exportPng.ts` (they share `balloonGeom`/`resolveBalloon` — keep
  it that way).
