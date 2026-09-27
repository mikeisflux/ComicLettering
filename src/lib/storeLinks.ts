/* Every store / download URL for the app's shells, in ONE place — the
   studio's Install dialog, the marketing "Get the App" page and the README
   used to each carry their own copy and drifted (two different Firefox
   add-on slugs shipped at once). `null` = listing not live yet. */
export const STORE_LINKS = {
  windows: "https://apps.microsoft.com/detail/9N61LFGVKNDM",   // Microsoft Store — LIVE
  play: "https://play.google.com/store/apps/details?id=com.lettermycomic.app",   // Google Play — LIVE
  apk: "https://github.com/mikeisflux/ComicLettering/releases/download/android-latest/app-release-signed.apk",
  edge: "https://microsoftedge.microsoft.com/addons/detail/lettermycomic-%E2%80%94-comic-let/mddigefnnjoickpabmiikhakjoeonafb",   // Edge Add-ons — LIVE
  firefox: "https://addons.mozilla.org/addon/lettermycomic-lettering-studio/",   // Firefox Add-ons — LIVE
  chrome: null as string | null,    // Chrome Web Store (submitted)
} as const;
