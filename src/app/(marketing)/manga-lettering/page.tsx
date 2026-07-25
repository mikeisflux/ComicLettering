import type { Metadata } from "next";
import Landing from "../_components/Landing";

export const metadata: Metadata = {
  title: "Manga Lettering Program — Letter Manga & Webtoons Online",
  description:
    "LetterMyComic is a manga lettering program that runs in your browser. Add manga speech bubbles, SFX, tall webtoon pages and manga fonts, then export print-ready or web-ready pages. Try the free demo.",
  keywords: [
    "manga lettering program", "manga lettering software", "manga lettering",
    "webtoon lettering", "manga speech bubbles", "manga fonts", "manga typesetting",
    "letter manga online", "scanlation lettering",
  ],
  alternates: { canonical: "/manga-lettering" },
  openGraph: {
    title: "Manga Lettering Program — Letter Manga & Webtoons Online",
    description: "A browser-based manga lettering program: manga bubbles, SFX, webtoon pages, manga fonts and print- or web-ready export.",
    url: "https://lettermycomic.com/manga-lettering",
    images: [{ url: "/shots/studio.png", width: 1600, height: 1000, alt: "LetterMyComic manga lettering program" }],
  },
};

export default function Page() {
  return (
    <Landing
      slug="manga-lettering"
      kicker="Manga Lettering Program"
      h1="Manga Lettering Program for Manga, Manhwa & Webtoons"
      lead="Letter manga and webtoons online with LetterMyComic. Set any page or tall vertical canvas, add manga-style speech bubbles and sound effects, and export clean pages for print or the web — all in your browser."
      sections={[
        {
          h: "Manga typesetting and lettering, no desktop app required",
          p: (
            <>
              <p>
                Manga typesetting has its own demands: tight speech bubbles, dramatic sound effects,
                vertical webtoon strips and readable dialogue at small sizes. LetterMyComic is a manga
                lettering program built for exactly that, and it runs in any browser — perfect for
                creators, scanlation teams and studios working across different computers.
              </p>
              <p>
                Set a standard manga page, a tankōbon trim size, or a long vertical webtoon canvas in
                Page Setup, drop your art onto the page, and start lettering. Nothing uploads unless
                you choose to save — your pages render locally on your machine.
              </p>
            </>
          ),
        },
        {
          h: "Manga speech bubbles and sound effects",
          p: (
            <>
              <p>
                Place clean speech bubbles, thought clouds, jagged shout balloons and borderless
                captions, each with a tail you drag toward the speaker. For manga SFX, apply bold
                lettering styles with outlines and gradients to make impact words leap off the page,
                then rotate and scale them freely across a panel.
              </p>
            </>
          ),
        },
        {
          h: "Manga fonts and webtoon-ready export",
          p: (
            <>
              <p>
                Choose from 150+ bundled comic and manga-style fonts with live previews, or upload the
                fonts your project uses. When you are done, export tall webtoon pages as PNG or JPG for
                the web, or print-ready PDF, TIFF and CBZ at up to 450&nbsp;DPI for physical volumes.
              </p>
            </>
          ),
        },
      ]}
      bullets={[
        { t: "Any manga page size", d: "Standard manga, tankōbon and custom trims in inches or pixels, portrait or landscape." },
        { t: "Tall webtoon canvases", d: "Set long vertical pages for webtoon and manhwa scrolling formats." },
        { t: "Manga speech bubbles", d: "Speech, thought, shout and caption balloons with aimable, bendable tails." },
        { t: "SFX lettering", d: "One-click styles for impactful manga sound effects and title text." },
        { t: "150+ fonts", d: "Comic and manga-style fonts with previews, plus your own uploads." },
        { t: "Print & web export", d: "PNG/JPG for the web, PDF/TIFF/CBZ at 150–450 DPI for print." },
      ]}
      faqs={[
        { q: "Can I letter webtoons and vertical scroll comics?", a: "Yes. In Page Setup you can create tall vertical canvases for webtoon and manhwa formats, then export them as long PNG or JPG images for the web." },
        { q: "Is this good for scanlation and manga typesetting?", a: "Yes. LetterMyComic gives you manga speech bubbles, sound-effect lettering, freeform text and font control — the core toolkit for manga typesetting — in a browser that works across a team." },
        { q: "What manga fonts are included?", a: "150+ comic and manga-style fonts are bundled with live previews, and you can upload your own font files to match a specific series or style." },
        { q: "Do I need to install software to letter manga?", a: "No. Everything runs in your browser on any operating system, so there is nothing to download or keep updated." },
      ]}
      related={[
        { href: "/comic-lettering-software", label: "Comic lettering software" },
        { href: "/comic-book-lettering", label: "Comic book lettering" },
        { href: "/comic-book-fonts", label: "Comic book fonts" },
        { href: "/features", label: "All features" },
      ]}
    />
  );
}
