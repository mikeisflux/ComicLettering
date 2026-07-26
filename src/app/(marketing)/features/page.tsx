import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features — Hand-Drawn Balloons, Pro Lettering Tools, 150+ Comic Fonts",
  description:
    "Every LetterMyComic feature: draw-your-own word balloons with auto-smoothing, joined balloons with band connectors, 150+ comic fonts, line spacing & tracking, rotation, format painter, find & replace, lettering-only transparent export, halftones, speedlines and print-ready PDF/PNG/TIFF/CBZ export.",
  alternates: { canonical: "/features" },
};

const GROUPS: { h: string; items: [string, string][] }[] = [
  {
    h: "Word Balloons",
    items: [
      ["Draw your own balloons", "Sketch a balloon by hand and it auto-smooths into a clean, closed shape — rounding your line into the most balanced bubble it can while keeping your composition."],
      ["Pick your tail", "Draw a tail and it's used automatically, or pick speech, thought or none from a popup. Tails start full-width where they meet the balloon, just like a pro letterer draws them."],
      ["Join balloons together", "Add a linked bubble with one button. Drag two balloons close and they merge into a single shape with a smooth connector band; drag apart and they split again — the joined bubble inherits the first one's style."],
      ["Three-point connector control", "The band joining two balloons has a middle handle for position and side handles for tilt, so you can bend and angle the join around the shape exactly how you want it."],
      ["Every classic type too", "Speech, rough, buzz, radio, thought, exclaim, whisper, square, TV, pill, rounded box and caption — any fill, outline weight, dashed strokes and shadows."],
    ],
  },
  {
    h: "Pro Lettering Tools",
    items: [
      ["Fit balloon to text", "One click resizes any balloon to hug its lettering — respecting your line breaks — so bubbles are never too baggy or too tight."],
      ["Balance the rag", "Auto-rebalance line breaks so every line in a balloon is close to the same length. Even 'rag' is the detail that reads as professional lettering."],
      ["Line spacing & tracking", "Dial in leading (line height) and letter tracking right from the format bar — the tight, even spacing that separates pro lettering from default type."],
      ["Rotate anything", "Rotate balloons, SFX and artwork clockwise or counter-clockwise in 90° or 15° steps, or reset to level in one click."],
      ["Format painter", "Copy a style off one balloon and paint it onto others — font, size, fill, outline and shadow — so a whole page matches in seconds."],
      ["Find & replace", "Fix a name or a typo across every page and every balloon at once, with optional case matching. Locked items stay untouched."],
      ["Safe-area guide", "Toggle a print safe-area overlay so nothing important lands where the trim could cut it."],
    ],
  },
  {
    h: "Lettering & Fonts",
    items: [
      ["150+ comic fonts", "A huge bundled library of open-licensed dialogue, display, horror, sci-fi and marker faces — plus original LetterMyComic faces made in-house — all load instantly and export perfectly."],
      ["28 style presets", "Sunburst, Chrome, Gold, Blood, Ice, Toxic and more — gradient fills, chunky outlines and shadows applied with one click."],
      ["Pro text control", "Size, bold, italic, ALL-CAPS, alignment, gradient fills, outline width and color, shadows — for balloons, captions and standalone SFX."],
    ],
  },
  {
    h: "Pages & Panels",
    items: [
      ["60+ panel layouts", "Eleven categories: Basic, Strips, 40's, 60's and 80's comics, Modern widescreen, Euro album, Manga, Graphic Novel, Picture-in-Picture and tilted Conceptual layouts."],
      ["Duplicate & reorder", "Duplicate a page complete with its lettering, then move pages up or down to reorder your book — with live thumbnails in the sidebar."],
      ["Any page size", "US comic, manga B5, A4, square and web-strip presets, or exact custom pixel sizes, with print-style rulers, ruler guides and coordinate tooltips."],
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
      ["Drop-in artwork", "Drag images straight onto the page or double-click a panel to fill it. Images resize proportionally and snap to the border for a perfect fit."],
      ["Lettering-only export", "Export just your balloons and text as a transparent PNG — drop your lettering straight onto artwork in any other tool."],
      ["Print-ready formats", "Full-resolution PNG, JPG, print TIFF, PDF and CBZ, at up to 450 dpi — plus a cloud project library, JSON backups and autosave."],
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
