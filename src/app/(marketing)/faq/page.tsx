import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — Comic Lettering Questions Answered",
  description:
    "Frequently asked questions about LetterMyComic: pricing, cancellation, fonts, export resolution, browser support, and how the browser-based comic lettering studio keeps your artwork private.",
  alternates: { canonical: "/faq" },
};

const FAQS: [string, string][] = [
  ["What is LetterMyComic?", "LetterMyComic is professional comic lettering software that runs entirely in your web browser. You get word balloons with draggable tails, SFX lettering styles, comic fonts, panel layouts, halftone and speedline fills, and print-ready PNG export — with no downloads or installs."],
  ["How much does it cost?", "Full access is $20 per month or $160 per year (four months free compared to monthly). There is one plan and everything is included. Payments are processed securely by PayPal."],
  ["Can I cancel anytime?", "Yes. Subscriptions renew automatically, but you can cancel from your PayPal account at any time and keep access until the end of the paid period."],
  ["Is there a free trial?", "No. To keep pricing simple and honest there is one paid plan. You can review every feature in detail on the features page before subscribing."],
  ["Does it work on my computer?", "Yes — LetterMyComic runs in any modern browser (Chrome, Edge, Firefox, Safari) on Windows, macOS, Linux and Chromebooks. There is nothing to install and updates are automatic."],
  ["Is my artwork uploaded to your servers?", "Your artwork renders locally in your browser and is never uploaded while you work. Only projects you explicitly save to your cloud library are stored on our servers, and they are private to your account."],
  ["What image formats can I import?", "PNG, JPG, WebP, GIF, AVIF, BMP, SVG, TIFF and PDF. TIFFs — the format most print-resolution scans arrive in — are converted automatically the moment you drop them in, and PDFs are rasterised page by page. Anything else is refused with a clear message rather than failing silently."],
  ["What fonts are included?", "Over sixty families are built in, each in regular, bold, italic and bold italic. Dialogue faces led by LMC Casual — the default lettering hand — plus Comic Neue, Patrick Hand and Kalam; display and SFX faces for impact, brush, torn-edge and chiselled looks; themed faces; and classic system stacks. Many are original LetterMyComic typefaces you will not find anywhere else, and every bundled font is properly licensed."],
  ["What resolution are exports?", "Pages export as full-resolution PNGs at your chosen page size — the default US comic page is 1500×2250 pixels, and you can set custom sizes up to 6000 pixels for print work."],
  ["Can I letter over my own artwork?", "Yes — drag your pencils, inks or finished art straight onto the page or into panels, then letter over them. Photo filters (black & white, sepia, noir and more) are included."],
  ["What happens to my projects if I cancel?", "Your projects remain stored and you can export JSON backups at any time. Re-subscribe and pick up exactly where you left off."],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function FAQ() {
  return (
    <main className="mktSection">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>Frequently Asked Questions</h2>
      <p className="sub">Everything you need to know before you start lettering.</p>
      <div className="faqList">
        {FAQS.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </main>
  );
}
