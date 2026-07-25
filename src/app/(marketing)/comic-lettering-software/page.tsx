import type { Metadata } from "next";
import Landing from "../_components/Landing";

export const metadata: Metadata = {
  title: "Comic Lettering Software — Online Comic Lettering Program",
  description:
    "LetterMyComic is professional comic lettering software that runs in your browser. Add word balloons, SFX lettering, panel layouts, halftones and comic fonts, then export print-ready pages. Try the free demo.",
  keywords: [
    "comic lettering software", "comic lettering program", "lettering software",
    "lettering tools", "online comic lettering", "comic book lettering software",
    "digital comic lettering", "balloon lettering software",
  ],
  alternates: { canonical: "/comic-lettering-software" },
  openGraph: {
    title: "Comic Lettering Software — Online Comic Lettering Program",
    description: "Professional comic lettering software in your browser: balloons, SFX styles, layouts, halftones and print-ready export.",
    url: "https://lettermycomic.com/comic-lettering-software",
    images: [{ url: "/shots/studio.png", width: 1600, height: 1000, alt: "LetterMyComic comic lettering software" }],
  },
};

export default function Page() {
  return (
    <Landing
      slug="comic-lettering-software"
      kicker="Comic Lettering Software"
      h1="Comic Lettering Software That Runs in Your Browser"
      lead="LetterMyComic is a modern comic lettering program you use online — no downloads, no installs, no crashes. Place word balloons, style your sound effects, drop in your artwork and export print-ready comic pages, all from a browser tab."
      sections={[
        {
          h: "A complete comic lettering program, online",
          p: (
            <>
              <p>
                Traditional comic lettering software means expensive desktop apps, font installs and
                version headaches. LetterMyComic replaces all of that with lettering tools that live
                in your browser and work on any computer — Windows, Mac, Linux or Chromebook. Your
                artwork is rendered locally on your machine, so pages stay fast and private, and your
                work autosaves as you letter.
              </p>
              <p>
                Whether you are lettering a single-page mini-comic or a full graphic novel, the studio
                gives you everything a professional comic book letterer expects: draggable balloon
                tails, one-click lettering styles, panel layouts, halftones, speedlines and export at
                up to 450&nbsp;DPI.
              </p>
            </>
          ),
        },
        {
          h: "Word balloons with tails you actually control",
          p: (
            <>
              <p>
                Choose from speech, thought, whisper, shout, radio, TV, burst and caption balloons —
                19 balloon types in all — or draw your own by hand. Every balloon has a draggable tail
                you aim at the speaker, a bend lever to curve it, and auto-join so two balloons merge
                into one shape when you push them together. It is the balloon lettering software
                workflow from professional desktop tools, rebuilt for the web.
              </p>
            </>
          ),
        },
        {
          h: "SFX lettering styles and 150+ comic fonts",
          p: (
            <>
              <p>
                Sound effects make comics pop. Apply any of 56 built-in lettering styles — glossy
                gradients, chunky outlines and drop shadows — to turn plain text into a BOOM or a
                WHOOSH in one click. Pair them with 150+ bundled comic fonts, including original
                typefaces you will not find anywhere else, plus the ability to upload your own fonts
                for your account.
              </p>
            </>
          ),
        },
      ]}
      bullets={[
        { t: "19 word balloon types", d: "Speech, thought, whisper, shout, radio, TV, dotted and more — with aimable tails, or hand-drawn." },
        { t: "56 lettering styles", d: "One-click gradient, outline and shadow presets to letter sound effects and titles." },
        { t: "150+ comic fonts", d: "Bundled comic book fonts with live previews, plus custom font upload." },
        { t: "Panel layouts", d: "60+ page templates from golden-age grids to modern widescreen and manga." },
        { t: "Halftones & speedlines", d: "Classic print halftones, motion lines, bursts and textures, sharp at any size." },
        { t: "Print-ready export", d: "PNG, JPG, TIFF, PDF and CBZ at 150–450 DPI, with a cloud project library." },
      ]}
      faqs={[
        { q: "What is comic lettering software?", a: "Comic lettering software is a program for adding word balloons, captions, sound effects and titles to comic art. LetterMyComic does all of this online, so you can letter a comic without installing desktop software." },
        { q: "Is LetterMyComic free?", a: "You can create an account and try the full studio free in demo mode. Saving, export and printing unlock with a subscription of $20/month or $160/year." },
        { q: "Do I need to install anything?", a: "No. LetterMyComic runs entirely in your browser on Windows, macOS, Linux and Chromebooks. There is nothing to download or update." },
        { q: "Can I use my own comic fonts?", a: "Yes. Along with 150+ bundled comic fonts, you can upload your own font files to your account and use them across your projects." },
        { q: "Can I export print-ready pages?", a: "Yes. Export to PNG, JPG, TIFF, PDF or CBZ at 150, 225, 300 or 450 DPI for print or digital publishing." },
      ]}
      related={[
        { href: "/manga-lettering", label: "Manga lettering" },
        { href: "/comic-book-lettering", label: "Comic book lettering" },
        { href: "/comic-book-fonts", label: "Comic book fonts" },
        { href: "/features", label: "All features" },
      ]}
    />
  );
}
