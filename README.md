# ComicLettering Studio

A **web-based comic lettering app** that runs entirely in your browser. There is no
server and nothing is ever uploaded — all layout, lettering, image handling and
export happen locally, using your own computer's resources.

**To use it:** open `index.html` in any modern browser (Chrome, Edge, Firefox),
or host the repository with GitHub Pages (Settings → Pages → deploy from branch,
root folder) and visit the published URL.

## Features

- **Pages** — multi-page documents, page thumbnails sidebar, page size presets
  (US comic, manga B5, A4, square, web strip) or custom pixel sizes, page background color.
- **Panel layouts** — one-click classic layouts (1, 2, 3, 4, 6, 9 panels and more)
  with margins and gutters, plus free-form panels you can drag, resize and restyle.
- **Balloons** — speech, thought (bumpy cloud + trailing bubbles), shout/burst,
  whisper (dashed), and caption boxes. Every balloon has a draggable tail handle
  (the orange dot) to aim it at a speaker.
- **Lettering** — double-click to type; comic-style font choices, size, bold /
  italic / ALL-CAPS, alignment, text color. SFX display lettering with thick
  outlines for sound effects ("POW!").
- **Artwork** — drag image files straight onto the page, or drop them into panels
  (double-click a panel to choose its image). Photo filters: black & white, sepia,
  vivid, faded, noir.
- **Editing** — move / resize / rotate handles, z-order (front/back), duplicate,
  arrow-key nudging, full undo/redo (Ctrl+Z / Ctrl+Y).
- **Saving** — projects save to a local `.json` file (images embedded) and reopen
  later; the app also autosaves to your browser between visits.
- **Export** — one-click PNG export of each page at full print resolution.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| Double-click | Edit balloon/SFX text · choose panel image |
| Ctrl/Cmd+Z · Ctrl/Cmd+Y | Undo · Redo |
| Ctrl/Cmd+D | Duplicate selection |
| Ctrl/Cmd+S | Save project file |
| Delete / Backspace | Remove selection |
| Arrow keys (+Shift) | Nudge (faster) |
| Shift while rotating | Snap to 15° |
| Esc | Finish typing / deselect |

## About the files in this repository

`Comic Life 3.zip` / `.z01`–`.z03` contain a copy of plasq's **Comic Life 3**, a
commercial desktop application. That program is closed-source, so it cannot be
"converted" to run in a browser, and its code, artwork, templates and fonts are
plasq's licensed property — none of them are used here. **ComicLettering Studio
is an original, independent implementation** (plain HTML/CSS/JavaScript, no
dependencies) that provides comparable comic-lettering functionality on the web.

> ⚠️ Note: because Comic Life 3 is commercial software, you may want to remove
> those zip archives from this public repository.
