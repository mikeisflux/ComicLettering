"use client";
/* Custom fonts & stamps (persisted in this browser + the account library),
   split from Editor.tsx (1500-line cap).

   Boot cost matters: the account library used to be fetched with every
   asset's full bytes on every visit (a dozen fonts ≈ 45 MB and a multi-
   second freeze, on phones too). Now boot fetches the LIST only; a font's
   bytes are fetched the first time something needs it — the open document
   uses it, it is picked in the font menu, or an export renders it. Stamps
   (small, shown in the tray) load in the background after boot.

   The local cache lives in IndexedDB, not localStorage: font data URLs in
   localStorage shared the ~5 MB budget with the autosave and silently
   broke it. */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { FONTS, registerFont } from "@/lib/model";
import { kvGet, kvSet } from "@/lib/assetStore";

export interface FontRec { key: string; label: string; family: string; data: string }
export interface StampRec { id: string; url: string; serverId?: string }

export const fontKeyFor = (label: string) => "custom_" + label.toLowerCase().replace(/\W+/g, "");

/* fonts registered in FONTS but whose bytes have not been fetched yet, and
   the in-flight loads — module level so every caller shares them */
const pendingSource = new Map<string, () => Promise<string | null>>();
const inflight = new Map<string, Promise<boolean>>();
const loadedKeys = new Set<string>();

async function addFace(rec: FontRec): Promise<boolean> {
  try {
    const face = new FontFace(rec.family, `url(${rec.data})`);
    await face.load();
    document.fonts.add(face);
    loadedKeys.add(rec.key);
    return true;
  } catch { return false; }   // corrupt font file
}

export const isCustomFontLoaded = (key: string) => !key.startsWith("custom_") || loadedKeys.has(key);

/* Load a custom font's bytes on demand. Resolves true once the face is in
   document.fonts (or was already). Unknown keys resolve false. */
export function ensureCustomFont(key: string): Promise<boolean> {
  if (isCustomFontLoaded(key)) return Promise.resolve(true);
  const hit = inflight.get(key);
  if (hit) return hit;
  const src = pendingSource.get(key);
  if (!src) return Promise.resolve(false);
  const p = (async () => {
    const data = await src().catch(() => null);
    if (!data || !FONTS[key]) return false;
    const label = FONTS[key].label;
    const ok = await addFace({ key, label, family: "LMC " + label, data });
    if (ok) pendingSource.delete(key);
    return ok;
  })();
  inflight.set(key, p);
  p.finally(() => inflight.delete(key));
  return p;
}

/* every custom font a document references — loaded before measuring,
   rendering thumbnails or exporting */
export async function ensureDocFonts(doc: { pages: { els: { type: string; ts?: { font: string } }[] }[] } | null): Promise<void> {
  if (!doc) return;
  const keys = new Set<string>();
  for (const p of doc.pages) for (const el of p.els) {
    if ((el.type === "balloon" || el.type === "text") && el.ts && el.ts.font.startsWith("custom_")) keys.add(el.ts.font);
  }
  await Promise.all([...keys].map((k) => ensureCustomFont(k)));
}

export function useFontsStamps() {
  const [customStamps, setCustomStamps] = useState<StampRec[]>([]);
  const [, bumpFonts] = useReducer((c: number) => c + 1, 0);
  const customFontIdsRef = useRef<Record<string, string>>({}); // font key -> server asset id

  /* a font whose bytes are in hand (import, or the local cache) */
  const registerRuntimeFont = useCallback(async (rec: FontRec) => {
    const ok = await addFace(rec);
    if (!ok) return;
    registerFont(rec.key, rec.label, rec.family);
    pendingSource.delete(rec.key);
    bumpFonts();
  }, []);

  /* a font known by name only — listed in the menu, fetched when needed */
  const registerLazyFont = useCallback((key: string, label: string, fetchData: () => Promise<string | null>) => {
    if (!FONTS[key]) registerFont(key, label, "LMC " + label);
    if (!loadedKeys.has(key)) pendingSource.set(key, fetchData);
  }, []);

  const loadAndBump = useCallback(async (key: string) => {
    const ok = await ensureCustomFont(key);
    if (ok) bumpFonts();   // re-render: the fallback face gives way to the real one
    return ok;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      /* local cache first (instant), then the account library */
      try {
        const stamps = await kvGet<StampRec[]>("stamps");
        if (Array.isArray(stamps) && !cancelled) setCustomStamps(stamps);
      } catch { /* ignore */ }
      try {
        const fonts = await kvGet<FontRec[]>("fonts");
        if (Array.isArray(fonts)) {
          for (const f of fonts) {
            if (!f?.key || !f.data) continue;
            /* cached bytes: register lazily too — the bytes are decoded only
               when the font is actually used */
            registerLazyFont(f.key, f.label, async () => f.data);
          }
          bumpFonts();
        }
      } catch { /* ignore */ }
      /* site-wide fonts installed by the site owner on the server */
      try {
        const res = await fetch("/api/site-fonts");
        if (res.ok) {
          const fonts: { name: string; url: string }[] = await res.json();
          for (const f of fonts) {
            const key = "site_" + f.name.toLowerCase().replace(/\W+/g, "");
            if (FONTS[key]) continue;
            try {
              const face = new FontFace("Site " + f.name, `url(${f.url})`);
              await face.load();
              document.fonts.add(face);
              registerFont(key, f.name, "Site " + f.name, "Site Fonts");
            } catch { /* bad font file — skip */ }
          }
          bumpFonts();
        }
      } catch { /* none */ }
      /* the account library: names only; bytes on demand */
      try {
        const res = await fetch("/api/assets");
        if (!res.ok) return;
        const assets: { id: string; kind: string; name: string }[] = await res.json();
        const fetchData = (id: string) => async () => {
          const r = await fetch(`/api/assets/${id}`);
          if (!r.ok) return null;
          return (await r.json()).data as string;
        };
        for (const a of assets.filter((x) => x.kind === "font")) {
          const key = fontKeyFor(a.name);
          customFontIdsRef.current[key] = a.id;
          registerLazyFont(key, a.name, fetchData(a.id));
        }
        bumpFonts();
        /* stamps: small, shown in the tray — fetch in the background, one at
           a time, server copies replacing any local cache of the same image */
        const stampMeta = assets.filter((a) => a.kind === "stamp");
        const stamps: StampRec[] = [];
        for (const a of stampMeta) {
          const data = await fetchData(a.id)().catch(() => null);
          if (cancelled) return;
          if (data) stamps.push({ id: a.id, url: data, serverId: a.id });
        }
        setCustomStamps((prev) => [
          ...stamps,
          ...prev.filter((p) => !p.serverId && !stamps.some((s) => s.url === p.url)),
        ]);
      } catch { /* offline — local cache still works */ }
    })();
    return () => { cancelled = true; };
  }, [registerLazyFont]);

  return { customStamps, setCustomStamps, bumpFonts, customFontIdsRef, registerRuntimeFont, ensureCustomFont: loadAndBump };
}
