"use client";
/* Custom fonts & stamps (persisted in this browser + the account library),
   split from Editor.tsx (1500-line cap). */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { FONTS, registerFont } from "@/lib/model";

export function useFontsStamps() {
  const [customStamps, setCustomStamps] = useState<{ id: string; url: string; serverId?: string }[]>([]);
  const [, bumpFonts] = useReducer((c: number) => c + 1, 0);
  const customFontIdsRef = useRef<Record<string, string>>({}); // font key -> server asset id

  const registerRuntimeFont = useCallback(async (rec: { key: string; label: string; family: string; data: string }) => {
    try {
      const face = new FontFace(rec.family, `url(${rec.data})`);
      await face.load();
      document.fonts.add(face);
      registerFont(rec.key, rec.label, rec.family);
      bumpFonts();
    } catch { /* corrupt font file — skip */ }
  }, []);

  useEffect(() => {
    /* local cache first (instant), then the account library from SQL */
    try {
      const stamps = JSON.parse(localStorage.getItem("lmc.stamps") || "[]");
      if (Array.isArray(stamps)) setCustomStamps(stamps);
    } catch { /* ignore */ }
    try {
      const fonts = JSON.parse(localStorage.getItem("lmc.fonts") || "[]");
      if (Array.isArray(fonts)) fonts.forEach((f) => registerRuntimeFont(f));
    } catch { /* ignore */ }
    /* site-wide fonts installed by the site owner on the server */
    (async () => {
      try {
        const res = await fetch("/api/site-fonts");
        if (!res.ok) return;
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
      } catch { /* none */ }
    })();
    (async () => {
      try {
        const res = await fetch("/api/assets");
        if (!res.ok) return;
        const assets: { id: string; kind: string; name: string; data: string }[] = await res.json();
        const stamps = assets.filter((a) => a.kind === "stamp")
          .map((a) => ({ id: a.id, url: a.data, serverId: a.id }));
        setCustomStamps((prev) => [
          ...stamps,
          ...prev.filter((p) => !p.serverId && !stamps.some((s) => s.url === p.url)),
        ]);
        for (const a of assets.filter((x) => x.kind === "font")) {
          const key = "custom_" + a.name.toLowerCase().replace(/\W+/g, "");
          customFontIdsRef.current[key] = a.id;
          if (!FONTS[key]) {
            await registerRuntimeFont({ key, label: a.name, family: "LMC " + a.name, data: a.data });
          }
        }
      } catch { /* offline — local cache still works */ }
    })();
  }, [registerRuntimeFont]);

  return { customStamps, setCustomStamps, bumpFonts, customFontIdsRef, registerRuntimeFont };
}
