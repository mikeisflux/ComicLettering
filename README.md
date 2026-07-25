# LetterMyComic — lettermycomic.com

A complete commercial platform for **lettermycomic.com**: an SEO-ready marketing
site, PayPal subscriptions ($20/mo · $160/yr, no trials), an admin console with
an internal inbox, and a professional **web-based comic lettering studio** at
`/app` — built on the latest stack:

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

## Platform (lettermycomic.com)

- **Marketing site** at `/` — landing, features, pricing, FAQ (with FAQ/SoftwareApplication
  JSON-LD), contact, terms, privacy, sitemap.xml, robots.txt, OpenGraph image.
- **Subscriptions**: PayPal ($20/month, $160/year, no trials). Admin → Payments creates
  the PayPal plans automatically; webhook keeps statuses in sync.
- **/app** — the studio, gated to active subscribers (admins bypass).
- **/admin** — Inbox (contact form + SendGrid Inbound Parse email, reply via SendGrid),
  Settings (all API keys stored in SQL: SendGrid, PayPal, reCAPTCHA v3, custom keys),
  Users (activate/suspend, comp access, admin roles), Payments setup.
- **Auth**: plain email/password (scrypt + HMAC session cookie), reCAPTCHA v3 on
  signup/login/contact when keys are set. First registered account becomes admin;
  `npm run db:seed` seeds divinitycomicsinc@gmail.com as admin with lifetime access
  (password from SEED_ADMIN_PASSWORD, printed once if unset).

## Studio highlights

Comic Life-style UI with pages/styles sidebars, rulers, tabbed right panel
(Layouts · Inspector · Layers · Photos · Library · Proof) and the balloon tray.
Balloons auto-join when dragged near each other (bendable connector lever, drag
tip to detach), images/PDFs drop straight into balloons and panels, Instant
Alpha background removal, procedural fills (gradients/halftones/tiles/speedlines/
textures), 28 lettering style presets + SFX word stamps, snapping with bleed/
margin/center/mirror/equal-spacing guides, Ctrl+[ / Ctrl+] centering, Shift for
proportional resize, auto-locking layers with a full right-click menu,
LanguageTool proofing + native spellcheck, Page Setup (paper sizes in inches,
orientation, document margins), print, and export to PNG/JPG/TIFF/PDF/CBZ with
a DPI selector and page ranges.
