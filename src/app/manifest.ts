import type { MetadataRoute } from "next";

/* Web-app manifest. Installing LetterMyComic as an app (Chrome/Edge on
   Windows, macOS, Linux and Android offer "Install app") registers the
   .lmc project-file type with the OS: saved projects get the app's icon
   and double-clicking one opens it straight into the studio (see the
   launchQueue consumer in Editor.tsx). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    /* a stable identity that survives URL changes (PWABuilder/Chromium) */
    id: "/app",
    name: "LetterMyComic",
    short_name: "LetterMyComic",
    description: "Professional comic lettering — word balloons, SFX and print-ready pages, right in your browser.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    /* the studio works in both orientations — never lock the device */
    orientation: "any",
    categories: ["photo", "productivity", "entertainment"],
    background_color: "#ffffff",
    theme_color: "#24303f",
    /* store-style install previews (Chromium install dialog, PWABuilder) */
    screenshots: [
      { src: "/shots/app/studio.webp", sizes: "1400x788", type: "image/webp", form_factor: "wide", label: "The lettering studio" },
      { src: "/shots/app/pages.webp", sizes: "1400x788", type: "image/webp", form_factor: "wide", label: "Pages and layouts" },
      { src: "/shots/app/pen.webp", sizes: "1400x788", type: "image/webp", form_factor: "wide", label: "Pen-first tablet lettering" },
      { src: "/shots/app/hero.webp", sizes: "720x1280", type: "image/webp", form_factor: "narrow", label: "Word balloons on your art" },
      { src: "/shots/app/type.webp", sizes: "720x1280", type: "image/webp", form_factor: "narrow", label: "600+ comic fonts" },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    /* the manifest lists ITSELF as a related webapp so
       getInstalledRelatedApps() can report "already installed" — the
       editor's install button hides then, even in a plain browser tab */
    related_applications: [
      { platform: "webapp", url: "https://lettermycomic.com/manifest.webmanifest" },
    ],
    /* not yet in Next's Manifest type — supported by Chromium's installed-app
       file handling; harmless extra JSON everywhere else */
    file_handlers: [
      {
        action: "/app",
        accept: { "application/x-lettermycomic": [".lmc"] },
        /* the icon Windows/ChromeOS stamp onto .lmc documents themselves */
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    ],
  } as unknown as MetadataRoute.Manifest;
}
