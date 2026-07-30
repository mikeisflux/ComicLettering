import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LetterMyComic — Comic Lettering Software in Your Browser",
  description:
    "Letter your comic book online: speech balloons with draggable tails, thought bubbles, SFX lettering styles, panel layouts, halftones and speedlines. Runs in your browser — export print-ready pages.",
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://lettermycomic.com/#org",
      name: "LetterMyComic",
      url: "https://lettermycomic.com",
      logo: "https://lettermycomic.com/icon.svg",
    },
    {
      "@type": "WebSite",
      "@id": "https://lettermycomic.com/#site",
      url: "https://lettermycomic.com",
      name: "LetterMyComic",
      publisher: { "@id": "https://lettermycomic.com/#org" },
    },
    {
      "@type": "SoftwareApplication",
      name: "LetterMyComic Studio",
      operatingSystem: "Web browser",
      applicationCategory: "DesignApplication",
      description:
        "Browser-based comic lettering studio: word balloons, lettering styles, panel layouts, halftone and speedline fills, PNG export.",
      offers: [
        { "@type": "Offer", price: "20.00", priceCurrency: "USD", description: "Monthly subscription" },
        { "@type": "Offer", price: "160.00", priceCurrency: "USD", description: "Yearly subscription" },
      ],
    },
  ],
};

const FEATURES = [
  { e: "💬", t: "Draw-your-own balloons", d: "Sketch a balloon by hand and it auto-smooths into a clean, closed bubble. Add linked balloons that merge with a smooth connector band when you drag them together — or pick from every classic type, each with a draggable tail." },
  { e: "🅰️", t: "Pro lettering tools", d: "Inline bold & italic, crossbar-I, fit-to-text and rag balancing, line spacing and tracking, rotation, a format painter, presets, and find & replace across your whole book — the touches that make lettering look professional." },
  { e: "💥", t: "SFX, scripts & spreads", d: "Warp sound effects along an arc, paste a comic script to auto-build balloons, and work in a two-page spread view that reads right across the gutter." },
  { e: "🪄", t: "Tuck SFX behind the art", d: "Clipping masks built in: draw around the part of your artwork that should come forward and it is cut out and placed in front of your lettering — big sound effects sit behind characters like hand-traced masks, no Photoshop required." },
  { e: "🔤", t: "150+ comic fonts & styles", d: "90+ pro SFX presets with gradient fills, outlines and drop shadows, plus 150+ built-in comic fonts — including original typefaces you won't find anywhere else." },
  { e: "🗒️", t: "60+ panel layouts", d: "Golden-age grids to modern widescreen, manga, Euro album and tilted action layouts — applied in one click. Duplicate and reorder pages as your story grows." },
  { e: "🎯", t: "Halftones & speedlines", d: "Classic print halftones, motion lines, bursts, tile screens and textures — generated sharp at any size." },
  { e: "🖼️", t: "Your art, your pages", d: "Drop artwork straight onto panels — it resizes proportionally and snaps to the border — apply photo filters, and letter over it. Nothing is ever uploaded." },
  { e: "🖨️", t: "Print-ready export", d: "PNG, JPG, TIFF, PDF and CBZ at up to 450 dpi — plus lettering-only transparent PNGs and a cloud project library so your books are saved and versioned." },
  { e: "⚡", t: "No installs, no crashes", d: "Runs in any modern browser on Windows, Mac, Linux and Chromebooks. Your work autosaves as you go." },
  { e: "🔒", t: "Private by design", d: "Your artwork renders locally in your browser. Only projects you choose to save touch our servers." },
];

export default function Home() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero">
        <h1>Letter Your Comic Like a Pro — Right in Your Browser</h1>
        <p className="lead">
          Speech balloons, SFX lettering, panel layouts, halftones and speedlines.
          LetterMyComic is the modern comic lettering studio that never crashes,
          never needs installing, and exports print-ready pages.
        </p>
        <div className="heroBtns">
          <Link className="btnBig primary" href="/signup?next=/app&demo=1">Try the Free Demo</Link>
          <Link className="btnBig secondary" href="/pricing">Pricing — $20/mo</Link>
        </div>
        <p className="heroNote">$20/month or $160/year · cancel anytime · works on any computer</p>
      </section>

      <section className="mktSection showcase" id="see-it">
        <h2>See It In Action</h2>
        <p className="sub">
          A real page lettered entirely in the browser — pro balloons, joined bubbles,
          SFX lettering styles and print halftones, over your own artwork.
        </p>
        <figure className="shotHero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/shots/studio.webp" width={1600} height={1000}
            alt="The LetterMyComic studio: a tank-battle comic page being lettered — a warped BADOOM! sound effect selected on the canvas, speech balloons and a caption over the artwork, with the full editor toolbar, lettering-style swatches, balloon tray, layouts and page thumbnails." />
          <figcaption>The full studio — toolbar, one-click lettering styles, balloon tray and layouts, all in your browser.</figcaption>
        </figure>
        <div className="shotRow">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/page.webp" width={492} height={751}
              alt="A finished snow-convoy comic page lettered in LetterMyComic: a caption, speech balloons, a joined balloon pair with an open connector, and a radio balloon over the artwork." />
            <figcaption>Finished pages export print-ready at up to 450 DPI.</figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shots/fonts.webp" width={250} height={479}
              alt="The font menu showing comic lettering fonts, each previewed live in its own typeface." />
            <figcaption>150+ comic fonts with live previews — plus upload your own.</figcaption>
          </figure>
        </div>
        <div className="heroBtns">
          <Link className="btnBig primary" href="/signup?next=/app&demo=1">Try the Demo Free</Link>
          <Link className="btnBig secondary" href="/pricing">See Pricing</Link>
        </div>
        <p className="heroNote">Free demo — create an account to start. Saving, export &amp; printing unlock with a subscription.</p>
      </section>

      <section className="mktSection" id="features">
        <h2>Everything a Comic Letterer Needs</h2>
        <p className="sub">
          Built for comic creators, webcomic artists, teachers and studios who want
          professional lettering without wrestling decades-old desktop software.
        </p>
        <div className="featGrid">
          {FEATURES.map((f) => (
            <div className="featCard" key={f.t}>
              <span className="emoji" aria-hidden>{f.e}</span>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mktSection alt">
        <div>
          <h2>From Blank Page to Printed Comic</h2>
          <p className="sub">
            Pick a page size and panel layout, drop in your artwork, aim your balloons,
            style your sound effects and export. A complete comic book lettering
            workflow in five steps — no plugins, no font installs, no lost work.
          </p>
          <div className="heroBtns">
            <Link className="btnBig primary" href="/pricing">Get Access — $20/mo</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
