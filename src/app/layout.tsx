import type { Metadata, Viewport } from "next";
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
  /* no `title`/`url` here: each page's own title (via the template) and
     path must flow through, or every share card said "LetterMyComic —
     Comic Lettering Software" and pointed at the home page */
  openGraph: {
    type: "website",
    siteName: "LetterMyComic",
    description:
      "Professional comic lettering in your browser: balloons, lettering styles, panel layouts, halftones, speedlines and print-ready export.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "LetterMyComic — comic lettering studio" }],
  },
  twitter: {
    card: "summary_large_image",
    description: "Letter your comic online: balloons, SFX styles, layouts, halftones and print-ready export.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

/* theme-color tints browser chrome before the app is installed; viewport-fit
   lets the editor pad itself past a phone's notch (see globals.css) */
export const viewport: Viewport = {
  themeColor: "#24303f",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
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
        {/* iOS App Store build (guideline 3.1.1): the wrapper's user agent
            carries "LmcIOS" (and it launches with ?store=ios) — stamp
            <html class="iosStore"> BEFORE first paint so pricing/purchase
            surfaces never flash. The UA is the source of truth, so a
            universal-link launch without the query still gets store mode,
            and nothing is persisted: opening ?store=ios once in Safari used
            to hide pricing in that browser forever.
            See src/lib/storeMode.ts for what the class hides. */}
        <script dangerouslySetInnerHTML={{ __html:
          "try{var w=/LmcIOS|PWAShell/.test(navigator.userAgent),q=new URLSearchParams(location.search).get('store')==='ios';if(w||q)document.documentElement.classList.add('iosStore')}catch(e){}",
        }} />
        {children}
      </body>
    </html>
  );
}
