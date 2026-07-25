# ComicLettering Studio

A modern, crash-proof **web-based comic lettering studio** in the spirit of the
classic desktop comic apps — rebuilt from scratch on the latest stack:

- **Next.js 15** (App Router) + **React 19** + TypeScript
- **SQL project library** via **Prisma ORM** — SQLite by default (zero config),
  switchable to PostgreSQL with one connection string
- All page editing, image handling and PNG rendering run **in the browser on
  the user's own computer** — artwork is never uploaded anywhere; the SQL
  database only stores projects you explicitly save to the Library.

## Running it

```bash
npm install        # installs deps + generates the Prisma client
npm run db:push    # creates the SQLite database (prisma/dev.db)
npm run dev        # http://localhost:3000
```

Production: `npm run build && npm start`.

To use PostgreSQL instead of SQLite: set `DATABASE_URL` in `.env` and change
`provider = "postgresql"` in `prisma/schema.prisma`, then `npm run db:push`.

## Features

**Pages & layouts**
- Multi-page documents, live page thumbnails, size presets (US comic, manga B5,
  A4, square, web strip) or custom sizes, rulers, zoom control.
- A full panel-layout library organized by style — Basic, Strips, 40's / 60's /
  80's Comic, Modern, Euro Comic, Manga, Graphic Novel, Picture-in-Picture and
  Conceptual (including tilted-panel layouts).

**Balloons** — every classic type, as crisp vector shapes with draggable tails:
speech, rough (hand-drawn), buzz, radio (double outline), thought, exclaim,
dense exclaim, whisper (dashed), square, TV (zigzag tail), pill, rounded box
and caption.

**Lettering**
- A STYLES panel of one-click "ABC" lettering presets — gradient fills, heavy
  outlines and drop shadows (Sunburst, Chrome, Gold, Toxic, Blood, Ice, …).
- 19 fonts: 15 bundled open-licensed (OFL) comic/display faces — Comic Neue,
  Patrick Hand, Kalam, Bangers, Luckiest Guy, Boogaloo, Chewy, Alfa Slab One,
  Bungee, Creepster, Nosifer, Audiowide, Permanent Marker, Courier Prime,
  League Gothic — plus system stacks. Self-hosted; nothing loads from CDNs.
- Full text control: size, bold/italic/ALL CAPS, alignment, solid or gradient
  fill, outline color/width, shadow. SFX display lettering included.

**Fills** — for page backgrounds, panels and balloons; all generated
procedurally so they stay sharp at any size:
- Solid colors and **gradients** (with a preset swatch library)
- **Halftone** dot fades (fine/medium/coarse; fade up/down/left/right, uniform, centered)
- **Tile patterns**: checks, dots, inverted dots, hex dots, hollow dots, small
  dots, diagonal/horizontal/vertical line screens, crosshatch, zigzag, noise screen
- **Speedlines**: radial burst (2 densities), ring, corner, motion lines, faded motion
- **Textures**: speckle, grit, static, murk, daubs, stone

**Artwork** — drag photos onto the page or double-click a panel to fill it;
imported photos live in the Photos tab for reuse; photo filters (B&W, sepia,
vivid, faded, noir); move/resize/rotate handles, z-order, duplicate, shadows.

**Saving & export**
- **Library (SQL)**: save/load/delete named projects with thumbnails.
- Autosave to the browser between visits; JSON file export/import.
- One-click full-resolution **PNG export** per page.
- Undo/redo (Ctrl+Z / Ctrl+Y), Ctrl+D duplicate, Ctrl+S save, arrow-key nudge.

## About the other files in this repository

`Comic Life 3.zip` / `.z01`–`.z03` contain a copy of plasq's **Comic Life 3**,
a commercial desktop application. It is closed-source and cannot be "converted"
to the web; its code, fonts, artwork and resources are plasq's licensed
property and **none of them are used here**. ComicLettering Studio is an
original, independent implementation of a comparable comic-lettering workflow;
its bundled fonts are OFL-licensed (see `public/fonts/LICENSE.txt`) and all
fills/patterns are generated procedurally.

> ⚠️ Because Comic Life 3 is commercial software, consider removing those zip
> archives from this public repository.
