import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get the App — LetterMyComic on Android, iPad & desktop",
  description:
    "Download LetterMyComic: the comic lettering studio as a native app for Android tablets and phones, iPad, Chromebook and desktop.",
  alternates: { canonical: "/get-the-app" },
};

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.lettermycomic.app";

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
            No store needed either: on Android Chrome use menu → <b>Install app</b>;
            on iPad Safari use Share → <b>Add to Home Screen</b>. Desktop
            installers live under File → <b>Install as App…</b> in the{" "}
            <Link href="/app">Studio</Link>.
          </p>
        </div>
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
