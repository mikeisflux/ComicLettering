# LetterMyComic User Guide

<!-- GENERATED from src/lib/userGuide.ts (rendered live at lettermycomic.com/guide).
     Edit that file, then run: node scripts/build-user-guide.js -->

Everything in the studio, one feature at a time. LetterMyComic runs entirely in your browser — nothing to install, no plugins, no generative AI anywhere: nothing on your page is generated, and your pages are never used to train anything. Work autosaves continuously as you go.

## Getting started

Create an account and the full studio opens at lettermycomic.com/app. Demo mode lets you try every tool; a subscription unlocks saving to your library, printing and print-ready export.

Your work saves itself: every change autosaves to the browser, and Save (Ctrl+S) writes the project to your online library so it follows you across devices. File → Save As… writes a real .lmc project file to disk, desktop-app style — double-clicking an .lmc file opens it straight into the studio once LetterMyComic is installed as an app.

- File → New Document starts a fresh book.
- The Library tab (right panel) lists every saved project with thumbnails — open, save-as-copy, export or delete from there.
- File → Open Project File… imports an .lmc from disk; Export file writes one out.

## The workspace

The studio is laid out like the classic desktop lettering tools: a menu bar and toolbar across the top, a format bar for type, the balloon tray along the bottom, the page in the middle, and a tabbed panel on the right (Layouts, Inspector, Layers, Proof, Photos, Library).

The status bar explains what the studio is doing and offers smart contextual tips while you work. Right-click anything on the page for a context menu with the actions that matter to it.

## Views: single page, spread, print

View → Single Page View shows one page at a time. Two-Page Spread View puts both facing pages on ONE live canvas — everything on either page is editable without clicking back and forth, and drags, lassos and sketches sweep freely across the spine. Two-Page Print View joins the facing pages at their trims, exactly as the printed spread will read.

- Zoom with Ctrl+= / Ctrl+-, fit the page (or the whole spread) with Ctrl+0.
- On tablets, pinch the empty workspace with two fingers to zoom, anchored under your fingers.
- PageUp / PageDown step through pages; the filmstrip on the left jumps anywhere.

## Pages, paper and guides

File → Page Setup… picks the paper: standard comic trim, manga sizes, US and international paper, or custom dimensions — all at print resolution with real bleed. View → Show Safe Area draws the trim (bleed line) and safe-area guides.

Insert → New Page adds pages (the toolbar and filmstrip can too); Duplicate Page copies one wholesale, and pages reorder from the filmstrip.

## Panels and artwork

The Layouts tab applies classic panel grids — pick a category and click a layout; balloons, lettering and images on the page are kept. Panels are also elements in their own right: draw one from the tray, resize it, give it a border and a fill.

### Auto panel detection

Already have the page drawn? Right-click the artwork → Detect Panels From Art (also in the Layouts tab and Insert menu). The studio reads the art's gutters and lays transparent panel frames over the panels it finds — restyle or delete any of them. It works best with clear gutters between panels.

### Importing art

Import photos and artwork in PNG, JPG, WebP, GIF, AVIF, BMP, SVG, TIFF or PDF — from the Photos tab, Insert → Image…, or by dropping files straight onto the page. Select a panel first and a clicked photo fills it (cover-cropped); filters (B&W, sepia, vivid, faded, noir) apply per image. Instant Alpha removes flat backgrounds from a stamp or logo.

Page art is the ONLY thing allowed past the bleed line — balloons, text and stamps clip hard at the trim (see The bleed line below).

## Word balloons

Balloons are the heart of the studio. The tray offers speech, thought, shout, burst, whisper, caption, and more; double-click any balloon to type. Balloons auto-fit their dialogue as you type, and Arrange → Fit Balloon to Text re-hugs one on demand.

### Tails

Drag the orange tail handle to aim the tail at the speaker; drag the red mid-handle to bend it. Captions and rounded boxes have no tail. Sketched custom balloons can carry a drawn tail, a speech taper or a thought-bubble trail.

### Joining balloons

Drop one balloon's tail inside another and they JOIN: connected by an open band, the way hand-inked dialogue chains are drawn. The band is open into both bubbles — no outline crosses the junctions — and its two edges stay parallel. Joined balloons share fill and gradient chain-wide, melt into one shape when they overlap, and separate cleanly. Chains join in any order, in either direction; right-click → Detach Balloon undoes a join.

### Custom shapes

The Sketch tool on the toolbar lets you draw a balloon outline by hand in one stroke — it is smoothed, closed and turned into a real balloon, keeping a tail if you drew one.

### Styles and presets

The Styles panel applies whole colourways; right-click → Save Style captures a balloon's look (or a lettering style) for reuse book-wide, and saved balloon presets restore shape + style together.

## Text and display lettering

Text boxes hold captions and credits; Lettering is display type for titles and sound effects. Both use the studio's 600+ comic fonts (Insert → Import Custom Font… adds your own), with per-word bold, italic and underline exactly as emphasis is done on the printed page. Dialogue follows comic grammar automatically, including the crossbar-I rule.

### Warping

Lettering warps two ways: arc/bend controls in the format bar, and the envelope warp tool — red dots on the corners and edges that you pull to reshape the word like taffy. Both work identically on the spread canvas, rotated or not.

### Fills, outlines, glows

Letters take solid colours, two-colour and multi-stop gradients, textures and halftones; outlines have their own width and colour; brush edges and glows finish the look. 100+ ready lettering styles apply from the Styles panel.

### Stamps

Insert → Stamps… opens a searchable library of ready SFX word art; Import Custom Stamps… adds your own PNGs. A stamp follows the LETTERING rules at the bleed line — right-click an imported image → Clip At Bleed (Stamp) marks it as one.

## Tuck Back: lettering behind the art

Tuck Back slips a sound effect behind foreground artwork so it reads like it was painted there. Select the lettering, choose Arrange → Tuck Back… (or the toolbar button), then drag around the foreground shape. The lasso is a magnetic pen: it snaps to the art's own edges as you trace — hold Alt to draw freehand. The enclosed art becomes a cutout sitting above the lettering.

- The dialog also offers a brightness cut and an on-device segmentation model (MobileSAM, Apache-2.0 — runs entirely in your browser, no cloud) for one-click cutouts.
- On the spread, a trace can sweep across the spine and cut the facing page's artwork too.
- Cutouts are ordinary images afterwards — move, restyle or delete them like anything else.

## The bleed line and facing pages

The bleed line (trim) is a hard border for word balloons, text boxes, lettering and stamps: no part of them is ever visible past it, in any view or export. Only page art may live in the bleed.

Whatever part of those items crosses the SPINE-side bleed line continues on the facing page, starting at that page's bleed line — the studio clips the near side and renders the remainder across the spread automatically (autoclipping self-replication), keeping the exact style, warp and Tuck Back. In single-page view a warning tip appears when a drag would carry an item onto the next page, so it never happens by mistake.

## Scripts, proofing and text tools

- Insert → Import Script → Balloons… breaks a whole comic script into balloons automatically, page by page.
- The Proof tab checks every balloon and lettering item with LanguageTool (free & open source); typos get red underlines while you type.
- Edit → Find & Replace… works across the page or the whole book.
- Arrange → Balance Line Breaks evens out a balloon's rag the way letterers break dialogue by hand.

## Layers, selection and arranging

Every item you place is its own layer — the Layers tab lists them front-to-back with reorder and lock buttons. New items lock automatically when you click away (toggle Auto-lock in the Layers tab); right-click → Unlock or the 🔒 button frees one.

- Ctrl+click adds items to a selection; Ctrl+A selects the page; dragging any member moves the whole convoy.
- Arrange offers forward/backward ordering, rotation (Shift snaps 15°), flips, centring, and align for multi-selections.
- Arrow keys micro-nudge for print-precise placement; Shift+arrows nudge farther.

## Working together

File → Share & Review… opens the team dialog. Share a book by email address with one of two roles: a LETTERER can edit the pages; an EDITOR gets a review view — they can read everything and leave notes, but not change the pages. Shared books appear in the collaborator's library marked 👥.

### Comment notes

The Note tool (📌 on the toolbar) drops numbered comment pins anywhere on the page — on either canvas. Click a pin to read the thread, resolve it or delete it. Everyone on the book sees the same pins.

### Review passes

When the lettering is ready, request a review pass from the team dialog. The editor approves it or requests changes with a note — the pass history stays with the book, so letterer and editor always know where things stand.

## Saving, exporting and printing

Export (Ctrl+E) renders print-ready pages: PNG, JPG or TIFF at full print resolution, PDF with crop and bleed marks for the printer, or CBZ for digital readers. A lettering-only export writes transparent overlays to hand back to the artist. Printing (Ctrl+P) is WYSIWYG with the editor — including the joined two-page print spread.

Everything you see in the editor is exactly what exports: balloon geometry, warps, gradients, Tuck Back and the bleed-line rules are shared between the live canvas and the export renderer.

## Tablets, pens and the installed app

LetterMyComic is pen-first on iPad and Android tablets. Palm rejection is automatic: while a stylus is near the screen, stray finger and palm touches can't start a drag, bend a lasso stroke or pinch the page. Handles grow to fingertip size on touch screens, and two-finger pinch zooms the workspace.

File → Install as App… installs the studio as a real app (Add to Home Screen on iPad). Installed, it opens .lmc project files from your file manager, works from the dock, and keeps the whole studio available like any native app.

## Keyboard shortcuts

- Selecting — Ctrl+A select all · Ctrl+Shift+A deselect · Ctrl+click add/remove one · Tab / Shift+Tab step through · Esc deselect or finish editing
- Adding — B balloon · T text · L lettering · P panel
- Editing — Ctrl+Z / Ctrl+Y undo, redo · Ctrl+D duplicate · Ctrl+C/X/V copy, cut, paste · Del delete
- While dragging — Shift keeps proportions resizing and snaps 15° rotating · Alt ignores snapping
- Text — double-click to edit · Ctrl+B / Ctrl+I bold or italic the selected words
- Pages & view — PageUp / PageDown pages · Ctrl+Shift+N duplicate page · Ctrl+= / Ctrl+- zoom · Ctrl+0 fit
- File — Ctrl+S save · Ctrl+Shift+S save as · Ctrl+E export · Ctrl+P print
