import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features — Balloons, Lettering Styles, Layouts, Halftones",
  description:
    "Every LetterMyComic feature: 13 word balloon types with draggable tails, 28 SFX lettering style presets, 19 comic fonts, 60+ panel layouts, halftone, speedline, tile and texture fills, photo filters and print-ready PNG export.",
  alternates: { canonical: "/features" },
};

const GROUPS: { h: string; items: [string, string][] }[] = [
  {
    h: "Word Balloons",
    items: [
      ["13 balloon types", "Speech, rough (hand-drawn), buzz, radio, thought, exclaim, dense exclaim, whisper, square, TV, pill, rounded box and caption."],
      ["Draggable tails", "Grab the orange handle and aim the tail at your speaker — the balloon reshapes itself smoothly, including zigzag TV tails and thought-bubble trails."],
      ["Full styling", "Any fill (solid, gradient, halftone, pattern, texture), outline color and weight, dashed whisper strokes and drop shadows."],
    ],
  },
  {
    h: "Lettering",
    items: [
      ["28 style presets", "Sunburst, Chrome, Gold, Blood, Ice, Toxic and more — gradient fills, chunky outlines and shadows applied with one click."],
      ["19 comic fonts", "Bundled open-licensed dialogue, display, horror, sci-fi and marker faces — they load instantly and export perfectly."],
      ["Pro text control", "Size, bold, italic, ALL-CAPS, alignment, gradient fills, outline width and color, shadows — for balloons, captions and standalone SFX."],
    ],
  },
  {
    h: "Pages & Panels",
    items: [
      ["60+ panel layouts", "Eleven categories: Basic, Strips, 40's, 60's and 80's comics, Modern widescreen, Euro album, Manga, Graphic Novel, Picture-in-Picture and tilted Conceptual layouts."],
      ["Any page size", "US comic, manga B5, A4, square and web-strip presets, or exact custom pixel sizes, with print-style rulers."],
      ["Multi-page books", "Add pages, reorder your story, and see live thumbnails in the pages sidebar."],
    ],
  },
  {
    h: "Fills & Effects",
    items: [
      ["Halftones", "Classic print dot screens in three densities with directional fades — generated mathematically so they stay razor sharp."],
      ["Speedlines", "Radial bursts, rings, corner blasts and horizontal motion lines for action panels."],
      ["Tiles & textures", "Checkerboards, dot screens, line screens, crosshatch, zigzag, noise, speckle, grit, murk and stone."],
    ],
  },
  {
    h: "Artwork & Export",
    items: [
      ["Drop-in artwork", "Drag images straight onto the page or double-click a panel to fill it. Reuse photos from the Photos tab."],
      ["Photo filters", "Black & white, sepia, vivid, faded and noir looks applied per panel."],
      ["Print-ready export", "Full-resolution PNG pages, cloud project library with thumbnails, JSON backup files and autosave."],
    ],
  },
];

export default function Features() {
  return (
    <main className="mktSection">
      <h2>Every Feature, Ready to Letter</h2>
      <p className="sub">A complete comic lettering toolkit — modern, fast and crash-proof.</p>
      {GROUPS.map((g) => (
        <section key={g.h} style={{ marginBottom: 38 }}>
          <h2 style={{ fontSize: 26 }}>{g.h}</h2>
          <div className="featGrid">
            {g.items.map(([t, d]) => (
              <div className="featCard" key={t}><h3>{t}</h3><p>{d}</p></div>
            ))}
          </div>
        </section>
      ))}
      <div className="heroBtns" style={{ marginTop: 22 }}>
        <Link className="btnBig primary" href="/pricing">Start Lettering — $20/mo</Link>
      </div>
    </main>
  );
}
