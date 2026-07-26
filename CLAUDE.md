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
- The parent balloon keeps its own pointed speaker tail, except when that
  tail aims into the joined child (then it is hidden so it never stacks on
  the connector).
- When joined balloons overlap they melt into one shape and the connector
  disappears; separating them brings the band back with a clean straight
  default (stale bend points must never fling or collapse the band).

## Code organization

- **No source file may exceed 1500 lines.** When a file grows past 1500
  lines, refactor it: split it into multiple focused, linked subfiles
  (e.g. a directory of modules re-exported from the original path). Apply
  this to any file you touch that is already over the limit.

## Editor/export parity

- The DOM editor and the canvas/PDF export must stay WYSIWYG: any change to
  text layout (line height, tracking, runs, warp, crossbar-I) or balloon
  geometry must be applied to BOTH `src/components/Editor*` rendering and
  `src/lib/exportPng.ts` (they share `balloonGeom`/`resolveBalloon` — keep
  it that way).
