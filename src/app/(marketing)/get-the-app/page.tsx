import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get the App — LetterMyComic on Android, iPad & desktop",
  description:
    "Download LetterMyComic: the comic lettering studio as a native app for Android tablets and phones, iPad, Chromebook and desktop.",
  alternates: { canonical: "/get-the-app" },
};

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.lettermycomic.app";
const APK_URL = "https://github.com/mikeisflux/ComicLettering/releases/download/android-latest/app-release-signed.apk";

/* Store listing URLs — flip each from null to its live URL as the store
   approves the listing (null renders an "In review — link coming soon"
   badge, so the card ships before the store does). */
const STORE_URLS: Record<string, string | null> = {
  windows: "https://apps.microsoft.com/detail/9N61LFGVKNDM",   // Microsoft Store — LIVE
  chrome: null,    // Chrome Web Store (submitted)
  edge: null,      // Microsoft Edge Add-ons (submitted)
  firefox: null,   // addons.mozilla.org (submitted)
};

/* one card per platform: the store path plus whatever works TODAY */
const PLATFORMS: {
  key: keyof typeof STORE_URLS; name: string; store: string; blurb: string;
  now: React.ReactNode;
}[] = [
  {
    key: "windows", name: "Windows", store: "Microsoft Store",
    blurb: "The studio as a real Windows app — Start-menu icon, its own window, .lmc files open straight into it.",
    now: <>Prefer to skip the store? Open the <Link href="/app">Studio</Link> in
      Chrome or Edge and click the red <b>Install as App</b> button — same app, one click.</>,
  },
  {
    key: "chrome", name: "Chrome", store: "Chrome Web Store",
    blurb: "A toolbar button that opens the studio in its own app window, no tabs or address bar.",
    now: <>You don&apos;t have to wait to install: in Chrome, open the <Link href="/app">Studio</Link> and
      click the red <b>Install as App</b> button (or the install icon in the address bar).</>,
  },
  {
    key: "edge", name: "Edge", store: "Edge Add-ons",
    blurb: "The same one-click launcher for Microsoft Edge.",
    now: <>Install the full app today: open the <Link href="/app">Studio</Link> in Edge and click the
      red <b>Install as App</b> button — Edge adds it to your Start menu and taskbar.</>,
  },
  {
    key: "firefox", name: "Firefox", store: "Firefox Add-ons",
    blurb: "Firefox can't install web apps, so our add-on fills the gap: a toolbar button that opens the studio in its own app window.",
    now: <>Meanwhile the studio runs perfectly in a Firefox tab — just open the{" "}
      <Link href="/app">Studio</Link>. The add-on adds the one-click app window.</>,
  },
];

/* store-badge buttons: custom-styled (no remote badge art), swap hrefs as
   each store listing goes live */
const badge: React.CSSProperties = {
  display: "inline-flex", flexDirection: "column", alignItems: "flex-start",
  padding: "10px 22px", borderRadius: 12, background: "#141a22", color: "#fff",
  textDecoration: "none", lineHeight: 1.15, border: "1.5px solid #33465c",
};

export default function GetTheAppPage() {
  return (
    <main className="mktSection">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 36, alignItems: "center", justifyContent: "center" }}>
        <img src="/shots/app/hero.webp" alt="LetterMyComic app" width={300}
          style={{ borderRadius: 18, border: "1px solid #d8dce2", boxShadow: "0 12px 40px #0003", maxWidth: "80vw", height: "auto" }} />
        <div style={{ maxWidth: 460 }}>
          <h1 style={{ fontFamily: "Bangers, cursive", letterSpacing: 1, fontSize: 44, margin: "0 0 10px" }}>
            Get the LetterMyComic app
          </h1>
          <p style={{ fontSize: 17, color: "#3c4654" }}>
            The full lettering studio — word balloons, 600+ fonts, SFX warps,
            Tuck Back and print-ready export — as a real app on your tablet,
            phone or Chromebook. Pen-first with palm rejection, and your work
            follows your account everywhere.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
            <a href={PLAY_URL} style={badge}>
              <small style={{ fontSize: 11, opacity: 0.8 }}>GET IT ON</small>
              <b style={{ fontSize: 19 }}>Google Play</b>
            </a>
            <span style={{ ...badge, opacity: 0.55, cursor: "default" }} aria-disabled>
              <small style={{ fontSize: 11, opacity: 0.8 }}>COMING SOON TO THE</small>
              <b style={{ fontSize: 19 }}>App Store</b>
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#5a6472", marginTop: 14 }}>
            Can&apos;t wait for the store? <a href={APK_URL}>Download the Android
            app directly (.apk)</a> — open the file on your device and allow
            the install when Android asks.
          </p>
          <p style={{ fontSize: 14, color: "#5a6472", marginTop: 10 }}>
            No store needed either: on Android Chrome use menu → <b>Install app</b>;
            on iPad Safari use Share → <b>Add to Home Screen</b>. Desktop
            installers live under File → <b>Install as App…</b> in the{" "}
            <Link href="/app">Studio</Link>.
          </p>
        </div>
      </div>

      {/* ---- every platform: the store path + what works today ---- */}
      <h2 style={{ textAlign: "center", marginTop: 56 }}>On every desktop &amp; browser</h2>
      <p className="sub" style={{ textAlign: "center", margin: "0 auto 26px", maxWidth: 640 }}>
        LetterMyComic is now on the Microsoft Store, with the browser stores in
        review — and you never have to wait for one: every platform has a way to
        install or run the studio today.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18 }}>
        {PLATFORMS.map((p) => {
          const url = STORE_URLS[p.key];
          return (
            <div key={p.key} style={{
              border: "1px solid #d8dce2", borderRadius: 14, padding: "18px 20px",
              background: "#fff", boxShadow: "0 6px 22px #0000000f",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ fontFamily: "Bangers, cursive", fontSize: 26, letterSpacing: 0.5 }}>{p.name}</div>
              <p style={{ margin: 0, fontSize: 14, color: "#3c4654", flexGrow: 1 }}>{p.blurb}</p>
              {url ? (
                <a href={url} style={{ ...badge, alignSelf: "flex-start" }}>
                  <small style={{ fontSize: 11, opacity: 0.8 }}>GET IT FROM THE</small>
                  <b style={{ fontSize: 17 }}>{p.store}</b>
                </a>
              ) : (
                <span style={{ ...badge, alignSelf: "flex-start", opacity: 0.55, cursor: "default" }} aria-disabled>
                  <small style={{ fontSize: 11, opacity: 0.8 }}>IN REVIEW — LINK COMING SOON</small>
                  <b style={{ fontSize: 17 }}>{p.store}</b>
                </span>
              )}
              <p style={{ margin: 0, fontSize: 13, color: "#5a6472" }}>{p.now}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 44 }}>
        {[
          ["/shots/app/studio.webp", "The full studio on your tablet"],
          ["/shots/app/pen.webp", "Pen-first lettering with palm rejection"],
          ["/shots/app/pages.webp", "Print-ready pages with real trim and bleed"],
          ["/shots/app/type.webp", "Type built for comics"],
        ].map(([src, alt]) => (
          <img key={src} src={src} alt={alt} loading="lazy"
            style={{ width: "100%", height: "auto", borderRadius: 14, border: "1px solid #d8dce2", boxShadow: "0 8px 28px #0002" }} />
        ))}
      </div>
    </main>
  );
}
