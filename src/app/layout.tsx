import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lettermycomic.com"),
  title: {
    default: "LetterMyComic — Comic Lettering Software in Your Browser",
    template: "%s | LetterMyComic",
  },
  description:
    "Letter your comic book online: speech balloons, thought bubbles, caption boxes, SFX lettering styles, panel layouts, halftones and speedlines. Professional comic lettering software that runs in your browser — no downloads, no crashes.",
  keywords: [
    "comic lettering software", "comic book lettering", "speech balloon maker",
    "comic creator online", "word balloons", "comic font", "SFX lettering",
    "comic panel layout", "webcomic tools", "make a comic online",
  ],
  applicationName: "LetterMyComic",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "LetterMyComic", statusBarStyle: "default" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "LetterMyComic",
    url: "https://lettermycomic.com",
    title: "LetterMyComic — Comic Lettering Software in Your Browser",
    description:
      "Professional comic lettering in your browser: balloons, lettering styles, panel layouts, halftones, speedlines and print-ready export.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LetterMyComic — comic lettering studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LetterMyComic — Comic Lettering Software in Your Browser",
    description: "Letter your comic online: balloons, SFX styles, layouts, halftones and print-ready export.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* register the (cache-free) service worker the moment the HTML
            parses — a post-hydration useEffect registered too late for
            store scanners' detection windows (PWABuilder gave up waiting) */}
        <script dangerouslySetInnerHTML={{ __html:
          "if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(function(){})}",
        }} />
        {children}
      </body>
    </html>
  );
}
