import type { MetadataRoute } from "next";

/* Web-app manifest. Installing LetterMyComic as an app (Chrome/Edge on
   Windows, macOS, Linux and Android offer "Install app") registers the
   .lmc project-file type with the OS: saved projects get the app's icon
   and double-clicking one opens it straight into the studio (see the
   launchQueue consumer in Editor.tsx). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LetterMyComic",
    short_name: "LetterMyComic",
    description: "Professional comic lettering — word balloons, SFX and print-ready pages, right in your browser.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#24303f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    /* not yet in Next's Manifest type — supported by Chromium's installed-app
       file handling; harmless extra JSON everywhere else */
    file_handlers: [
      { action: "/app", accept: { "application/x-lettermycomic": [".lmc"] } },
    ],
  } as MetadataRoute.Manifest;
}
