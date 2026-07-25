import type { Metadata } from "next";
import Landing from "../_components/Landing";

export const metadata: Metadata = {
  title: "Comic Book Fonts — 150+ Comic Fonts, Letter Online",
  description:
    "Letter with 150+ comic book fonts online. LetterMyComic bundles dialogue, display and SFX comic fonts with live previews, original typefaces and custom font upload — then export print-ready pages. Free demo.",
  keywords: [
    "comic book fonts", "comic fonts", "comic lettering fonts", "manga fonts",
    "sfx fonts", "comic dialogue font", "free comic fonts", "comic font generator",
  ],
  alternates: { canonical: "/comic-book-fonts" },
  openGraph: {
    title: "Comic Book Fonts — 150+ Comic Fonts, Letter Online",
    description: "150+ comic book fonts with live previews, original typefaces and custom upload — letter and export online.",
    url: "https://lettermycomic.com/comic-book-fonts",
    images: [{ url: "/shots/fonts.png", width: 250, height: 480, alt: "Comic book fonts menu with live previews" }],
  },
};

export default function Page() {
  return (
    <Landing
      slug="comic-book-fonts"
      kicker="Comic Book Fonts"
      h1="150+ Comic Book Fonts, Built for Lettering"
      lead="Great comic book fonts are the difference between amateur and professional pages. LetterMyComic ships with 150+ dialogue, display and sound-effect fonts — each previewed live in its own typeface — plus original faces you won’t find anywhere else and the ability to upload your own."
      sections={[
        {
          h: "Dialogue, display and SFX fonts in one place",
          p: (
            <>
              <p>
                Comic lettering uses different fonts for different jobs: a clean, readable dialogue
                face for balloons; bold display faces for titles; and rough, energetic faces for sound
                effects. LetterMyComic organizes its comic book fonts into those groups so you can pick
                the right one fast, and every font previews live in the menu in its own style.
              </p>
              <p>
                Many fonts include bold, italic and bold-italic weights, selectable from a subtype
                picker beside the font name — so emphasis and shouting read the way a professional
                letterer would set them.
              </p>
            </>
          ),
        },
        {
          h: "Original typefaces you can only get here",
          p: (
            <>
              <p>
                Alongside a large library of open-licensed comic fonts, LetterMyComic includes a family
                of original typefaces designed specifically for comic lettering — dialogue, casual,
                shout, horror, sci-fi and more. They give your pages a look that isn’t on every other
                webcomic, and they are cleared for use in your published work.
              </p>
            </>
          ),
        },
        {
          h: "Upload your own comic fonts",
          p: (
            <>
              <p>
                Have a font your series already uses? Upload your own font files to your account and
                they appear in the menu next to the built-in faces, synced across your browsers. Pair
                any font with 56 one-click lettering styles to add gradients, outlines and shadows for
                instant sound-effect and title treatments.
              </p>
            </>
          ),
        },
      ]}
      bullets={[
        { t: "150+ comic fonts", d: "Dialogue, display and SFX faces, grouped and previewed live in the menu." },
        { t: "Bold & italic weights", d: "Subtype picker for regular, bold, italic and bold-italic where available." },
        { t: "Original typefaces", d: "Exclusive comic lettering fonts designed in-house and cleared for your work." },
        { t: "Custom font upload", d: "Add your own font files to your account and use them across projects." },
        { t: "56 lettering styles", d: "Turn any font into a BOOM with one-click gradient, outline and shadow presets." },
        { t: "Print-ready output", d: "Fonts render crisply on export to PNG, JPG, TIFF, PDF and CBZ up to 450 DPI." },
      ]}
      faqs={[
        { q: "How many comic fonts are included?", a: "LetterMyComic bundles over 150 comic book fonts covering dialogue, display and sound-effect styles, each with a live preview in the font menu." },
        { q: "Can I upload my own fonts?", a: "Yes. You can upload your own font files to your account and use them alongside the built-in comic fonts across all your projects." },
        { q: "Are the fonts free to use in my comic?", a: "The bundled fonts are open-licensed or original faces cleared for use in your published work. The included original LetterMyComic typefaces are exclusive to the app." },
        { q: "Can I make sound-effect (SFX) lettering from a font?", a: "Yes. Apply any of 56 one-click lettering styles to a font to add gradients, thick outlines and drop shadows for instant SFX and title lettering." },
      ]}
      related={[
        { href: "/comic-lettering-software", label: "Comic lettering software" },
        { href: "/comic-book-lettering", label: "Comic book lettering" },
        { href: "/manga-lettering", label: "Manga lettering" },
        { href: "/features", label: "All features" },
      ]}
    />
  );
}
