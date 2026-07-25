import type { Metadata } from "next";
import Landing from "../_components/Landing";

export const metadata: Metadata = {
  title: "Comic Book Lettering — Letter Your Comic Online",
  description:
    "Do professional comic book lettering online with LetterMyComic: word balloons with draggable tails, caption boxes, SFX lettering, panel layouts and comic fonts. Export print-ready pages. Free demo.",
  keywords: [
    "comic book lettering", "comic lettering", "how to letter a comic",
    "word balloons", "speech balloon maker", "caption boxes", "sound effect lettering",
    "letter a comic online", "digital lettering",
  ],
  alternates: { canonical: "/comic-book-lettering" },
  openGraph: {
    title: "Comic Book Lettering — Letter Your Comic Online",
    description: "Professional comic book lettering online: balloons, captions, SFX, layouts and print-ready export.",
    url: "https://lettermycomic.com/comic-book-lettering",
    images: [{ url: "/shots/page.png", width: 492, height: 738, alt: "Comic book lettering example" }],
  },
};

export default function Page() {
  return (
    <Landing
      slug="comic-book-lettering"
      kicker="Comic Book Lettering"
      h1="Comic Book Lettering, Done Right in Your Browser"
      lead="Comic book lettering is more than typing in a bubble — it is balloon placement, tail direction, reading order, sound effects and clean type. LetterMyComic gives you every one of those tools online, so your pages read like a professionally lettered comic."
      sections={[
        {
          h: "The craft of comic book lettering",
          p: (
            <>
              <p>
                Good comic book lettering guides the reader’s eye through a page. That means balloons
                placed in reading order, tails that point clearly to who is speaking, captions that set
                the scene, and sound effects that add energy without covering the art. LetterMyComic is
                built around that craft: it is comic lettering software made for letterers, not a
                generic graphics editor.
              </p>
              <p>
                Drop your finished art onto a page, then letter over it. Balloons auto-lock when you
                want them to stay put, layers let you send elements forward and back, and snapping
                guides keep everything aligned to the bleed, margins and each other.
              </p>
            </>
          ),
        },
        {
          h: "Balloons, tails and captions",
          p: (
            <>
              <p>
                Place speech, thought, whisper and shout balloons, plus rectangular caption and
                narration boxes. Drag each tail to the speaker and bend it with a lever; push two
                balloons together and they merge into a single connected shape, just like hand
                lettering. Everything scales cleanly because balloons are drawn as vectors.
              </p>
            </>
          ),
        },
        {
          h: "Sound effects, styles and export",
          p: (
            <>
              <p>
                Letter your SFX with 56 one-click styles — gradients, outlines and shadows — and 150+
                comic fonts. When the page is done, export it print-ready as PNG, JPG, TIFF, PDF or CBZ
                at up to 450&nbsp;DPI, or print directly. Your projects save to a cloud library so a
                whole book stays organized.
              </p>
            </>
          ),
        },
      ]}
      bullets={[
        { t: "Reading-order balloons", d: "Place and stack balloons with equal-spacing and level helpers for clean flow." },
        { t: "Aimable tails", d: "Drag tails to the speaker, bend them, and auto-join balloons into one shape." },
        { t: "Caption & narration boxes", d: "Set the scene with clean caption boxes and borderless narration." },
        { t: "SFX lettering", d: "56 gradient/outline/shadow styles to letter sound effects and titles." },
        { t: "Spelling & grammar", d: "Built-in open-source spell and grammar checking as you letter." },
        { t: "Print-ready export", d: "PNG, JPG, TIFF, PDF and CBZ at 150–450 DPI, plus direct print." },
      ]}
      faqs={[
        { q: "How do I letter a comic online?", a: "Create an account, open the studio, set your page size, drop in your art, then add balloons and captions, aim their tails, letter your sound effects, and export the finished page. You can try the whole process free in demo mode." },
        { q: "Can I letter over my own artwork?", a: "Yes. Drag PNG, JPG or PDF art straight onto the page or into panels, then letter on top. Your art is rendered locally in your browser." },
        { q: "Does it check spelling and grammar?", a: "Yes. LetterMyComic includes open-source spelling and grammar checking so you can catch typos before you export." },
        { q: "What formats can I export for print?", a: "Export to PNG, JPG, TIFF, PDF or CBZ at 150, 225, 300 or 450 DPI — suitable for both print and digital comics." },
      ]}
      related={[
        { href: "/comic-lettering-software", label: "Comic lettering software" },
        { href: "/manga-lettering", label: "Manga lettering" },
        { href: "/comic-book-fonts", label: "Comic book fonts" },
        { href: "/pricing", label: "Pricing" },
      ]}
    />
  );
}
