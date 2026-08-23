# LetterMyComic — [lettermycomic.com](https://lettermycomic.com)

**Professional comic lettering in the browser.** Word balloons that behave like
hand-inked lettering, 600+ comic fonts, SFX warps, Tuck Back clipping masks,
panel layouts, page grading and print-ready export — one web codebase that
ships as the website, the installed desktop app, the Windows Store app, the
Android app and (in progress) the iOS app.

Built and operated by **Divinity Comics Inc**.

## Where it ships

| Form | Status | Where |
|---|---|---|
| Web studio | Live | [lettermycomic.com/app](https://lettermycomic.com/app) |
| Installed PWA (Chrome/Edge desktop) | Live | "Install as App" in the studio |
| Microsoft Store (Windows MSIX) | Live | [apps.microsoft.com/detail/9N61LFGVKNDM](https://apps.microsoft.com/detail/9N61LFGVKNDM) |
| Google Play (Android TWA) | Live | [play.google.com/store/apps/details?id=com.lettermycomic.app](https://play.google.com/store/apps/details?id=com.lettermycomic.app) |
| Firefox add-on (app-window launcher) | Live | [addons.mozilla.org/addon/lettermycomic-lettering-studio](https://addons.mozilla.org/addon/lettermycomic-lettering-studio/) |
| Edge add-on | Live | [Edge Add-ons listing](https://microsoftedge.microsoft.com/addons/detail/lettermycomic-%E2%80%94-comic-let/mddigefnnjoickpabmiikhakjoeonafb) |
| Chrome Web Store | In review | — |
| iOS / iPadOS (App Store) | Pipeline ready | built from `ios/` by GitHub Actions |

Every form is the SAME code — there are no separate app codebases. A deploy to
the website updates them all (store packages are thin wrappers; they only need
regenerating when the manifest changes).

## The studio

- **Balloons** — every classic type as crisp vector shapes with draggable,
  bendable tails. Balloons dragged together **join** with an open connector
  band (no stroke across the junction, like hand-inked lettering); overlapping
  joined balloons melt into one shape. Fit-to-text (Ctrl+\\), saved presets,
  custom hand-drawn balloons.
- **Lettering** — 600+ comic fonts across genre groups plus custom font
  import, 90+ SFX style presets, per-word bold/italic/underline, smart
  crossbar-I, arc/bend warping with a full envelope warp tool, tracking, rag
  balancing, find & replace, spell/grammar proofing.
- **Tuck Back** — trace with a magnetic lasso or pen path (or on-demand
  auto-detect) and the traced art is cut out and placed in front of the
  lettering, balloon or text box: clipping masks with zero Photoshop. Works
  across the spread spine.
- **Pages** — panel-layout library by era/style plus **custom saved layouts**
  and **Draw Your Own Panel** (pen tool with curved anchors, rect/oval/circle
  marquees), auto panel detection from page art, two-page spread view and
  trim-joined print view, cross-page drags.
- **Art** — drop images/PDFs onto panels, pan/zoom the picture inside its
  frame (Alt-drag or inspector sliders), Instant Alpha background removal,
  photo filters, fade-to-white/black corner fades, procedural fills
  (gradients, halftones, tile screens, speedlines, textures).
- **Page grading** — 17 adjustment-layer tools (curves, levels with
  eyedroppers, HSL, selective color, channel mixer, color lookup, gradient
  map, black & white, photo filter, exposure, grain, clarity …) with
  Photoshop-style floating panels, live histograms and identical results in
  the editor and every export.
- **Layers** — eyeballs, drag-to-reorder, rename, groups, copy-to-pages,
  right-click menu, pinned control strip.
- **Collaboration** — shared books, pinned comments and review passes
  (editors mark up read-only; the letterer saves).
- **Import/export** — comic-script import that auto-builds balloons; export
  to PNG/JPG/TIFF/PDF/CBZ up to 450 dpi with bleed/crop marks, page ranges,
  transparent lettering-only overlays; `.lmc` project files that open with
  the installed apps by double-click.
- **Bleed discipline** — balloons, text and stamps hard-clip at the trim and
  continue across the spine on the facing page; only page art may live in the
  bleed. The DOM editor and the canvas/PDF exporter share geometry, so what
  you see is exactly what prints.

**Privacy stance:** full-resolution artwork is processed locally in the
browser and never uploaded; only projects explicitly saved to the Library
touch the server. No generative AI in the product.

## Platform

- **Marketing site** at `/` — SEO landing pages, features, pricing, FAQ, blog
  with original lettering tutorials, user guide, JSON-LD, sitemap.
- **Pricing** — $160/year subscription, one-time 3-month ($40) and 6-month
  ($80) passes, limited $500 lifetime tier. (A legacy $20/month plan is
  retired; existing monthly subscribers are grandfathered.) PayPal billing
  with webhook status sync.
- **/app** — the studio, demo mode for everyone, full access for subscribers.
- **/admin** — inbox (contact + SendGrid inbound email with in-place reply),
  users, payments setup, settings (all API keys stored in SQL).
- **Auth** — email/password (scrypt + HMAC session cookie), reCAPTCHA v3,
  account deletion page (store-compliance requirement).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Prisma (PostgreSQL; SQLite
for zero-config dev) · PayPal REST · SendGrid · PM2 cluster behind Caddy.

## Development

```bash
npm install        # deps + Prisma client
npm run db:push    # create the dev database
npm run dev        # http://localhost:3000
```

Before pushing: `npx tsc --noEmit && npx next build` must pass. Read
**CLAUDE.md** first — it carries the non-negotiable invariants (joined-balloon
connector behavior, the bleed line, editor/export parity, the 1500-line file
cap, fix-on-both-canvases and fix-every-entry-point rules).

## Deploying

`scripts/deploy.sh` builds, health-checks and zero-downtime-reloads the PM2
cluster (`ecosystem.config.js`, 2 instances), rolling back on a failed health
check. The Help → **Check for Updates** menu item in the studio compares an
open window's build stamp against `/api/version` so long-lived installed-app
windows can pull a fresh deploy.

## Repository layout

| Path | What |
|---|---|
| `src/` | The entire web app — marketing site, studio, API routes |
| `src/lib/` | Engines: balloon geometry, fills, export/PDF, page grading, model |
| `src/components/editor/` | Studio UI split into focused modules |
| `prisma/` | Schema + seeds |
| `ios/` | iOS wrapper app (WKWebView shell) + fastlane release lane |
| `tablet/` | Android TWA (Play) and related tablet packaging |
| `desktop/` | Electron wrapper (`.lmc` file association for non-store installs) |
| `firefox-addon/` | Firefox/Chromium extension: app-window launcher |
| `scripts/` | Deploy + operations |
| `docs/` | Internal docs (lettering knowledgebase, campaign copy) |

## Store release notes

- **Windows (MSIX)** — regenerate on [PWABuilder](https://pwabuilder.com) only
  when the manifest changes; bump both package versions past the live ones and
  submit as an update in Partner Center. File-type association gives `.lmc`
  files the app icon on install.
- **Android** — Play listing id `com.lettermycomic.app`; TWA rebuilt from the
  live manifest.
- **iOS** — no Mac required: GitHub Actions (**iOS — Build & Upload to App
  Store Connect**, manual trigger) builds `ios/`, manages signing via fastlane
  match (encrypted on the `ios-certs` branch) and uploads to App Store
  Connect. Needs the `KEY_ID` / `ISSUER_ID` / `PRIVATE_KEY` /
  `MATCH_PASSWORD` repository secrets. The wrapper launches
  `/app?store=ios`, which activates a store-compliance mode that hides all
  external-purchase surfaces (Apple guideline 3.1.1) — subscribers sign in
  with their web account (3.1.3 multiplatform services).

## License

Proprietary — © Divinity Comics Inc. All rights reserved. Bundled fonts are
OFL-licensed (see `public/fonts/LICENSE.txt`); all fills and patterns are
generated procedurally.
