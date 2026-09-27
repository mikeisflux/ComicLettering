/* Custom fonts and stamps — import, account-library upload, removal — and
   the built-in SFX stamps. Split from ops.ts (1500-line cap); ops.ts
   re-exports everything here so call sites are unchanged. */
import { FONTS } from "@/lib/model";
import { kvGet, kvSet } from "@/lib/assetStore";
import { loadImage } from "@/lib/exportPng";
import { EditorCtx } from "./ctx";
import { FontRec, fontKeyFor } from "./useFontsStamps";
import {
  ART_FORMATS_LABEL, isSupportedArtFile, isTiffFile, nextAid, normalizeArtFile, placeAsset,
  readAsDataURL, stashArt, stashDataUrl,
} from "./ops";

/* the server's answer, or WHY it refused (logged out, demo, too large,
   library full) — the caller tells the user instead of claiming success */
export async function uploadAsset(kind: "font" | "stamp", name: string, data: string): Promise<{ id: string } | { error: string }> {
  try {
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, data }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: body.error || (res.status === 401 ? "Sign in to save it to your account." : res.status === 402 ? "An active subscription saves it to your account." : "The upload failed.") };
    }
    return { id: String(body.id) };
  } catch { return { error: "Network problem — it could not reach your account library." }; }
}

export async function importFontFiles(ed: EditorCtx, files: File[]) {
  const { registerRuntimeFont, setStatus, customFontIdsRef } = ed;
  let list: FontRec[] = [];
  try { list = (await kvGet<FontRec[]>("fonts")) ?? []; } catch { /* ignore */ }
  const saved: string[] = [], local: string[] = [];
  let why = "";
  for (const f of files) {
    const label = f.name.replace(/\.(ttf|otf|woff2?)$/i, "");
    const key = fontKeyFor(label);
    const family = "LMC " + label;
    const data = await readAsDataURL(f);
    const rec = { key, label, family, data };
    await registerRuntimeFont(rec);
    if (!FONTS[key]) { setStatus(`Could not load font "${f.name}".`); continue; }
    list = [...list.filter((x) => x.key !== key), rec];
    /* re-importing a name replaces the account copy — a second server row
       under the same name meant the OLD file won on the next reload */
    const prior = customFontIdsRef.current[key];
    if (prior) await fetch(`/api/assets/${prior}`, { method: "DELETE" }).catch(() => { });
    const up = await uploadAsset("font", label, data);
    if ("id" in up) { customFontIdsRef.current[key] = up.id; saved.push(label); }
    else { local.push(label); why = up.error; }
  }
  const cached = await kvSet("fonts", list).catch(() => false);
  const n = saved.length + local.length;
  if (!n) return;
  if (!local.length) {
    setStatus(`Font${n > 1 ? "s" : ""} imported — find ${n > 1 ? "them" : "it"} under “My Fonts”. Saved to your account; ${n > 1 ? "they follow" : "it follows"} you to any computer.`);
  } else {
    setStatus(`${local.join(", ")} imported for ${cached ? "this computer" : "this session"} only — ${why}${saved.length ? ` (${saved.join(", ")} saved to your account.)` : ""}`);
  }
}

export async function deleteCustomFont(ed: EditorCtx, key: string) {
  const { customFontIdsRef, bumpFonts, docRef, setStatus } = ed;
  const label = FONTS[key]?.label ?? key;
  let uses = 0;
  for (const p of docRef.current?.pages ?? []) for (const el of p.els) {
    if ((el.type === "balloon" || el.type === "text") && el.ts.font === key) uses++;
  }
  if (!window.confirm(`Remove “${label}” from your fonts?${uses ? ` ${uses} item${uses > 1 ? "s" : ""} in this book use${uses > 1 ? "" : "s"} it and will fall back to Comic Neue.` : ""}`)) return;
  const serverId = customFontIdsRef.current[key];
  if (serverId) fetch(`/api/assets/${serverId}`, { method: "DELETE" }).catch(() => { });
  delete customFontIdsRef.current[key];
  const family = FONTS[key]?.css.split(",")[0].replace(/"/g, "");
  delete FONTS[key];
  /* drop the loaded face too, or the removed font keeps rendering until reload */
  try { document.fonts.forEach((f) => { if (f.family === family) document.fonts.delete(f); }); } catch { /* ignore */ }
  bumpFonts();
  try {
    const list = ((await kvGet<FontRec[]>("fonts")) ?? []).filter((x) => x.key !== key);
    await kvSet("fonts", list);
  } catch { /* ignore */ }
  setStatus(`Removed “${label}”.${uses ? " Items that used it now show Comic Neue." : ""}`);
}

export async function importStampFiles(ed: EditorCtx, files: File[]) {
  const { customStamps, setCustomStamps, setStatus } = ed;
  const list = [...customStamps];
  let saved = 0, local = 0, why = "";
  for (const f of files) {
    if (!isSupportedArtFile(f) || f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      setStatus(`"${f.name}" isn't a supported stamp image — use ${ART_FORMATS_LABEL.replace(" or PDF", "")}.`);
      continue;
    }
    let blob: Blob = f;
    if (isTiffFile(f)) {
      try { blob = await normalizeArtFile(f); }
      catch { setStatus(`Could not read "${f.name}" — save that TIFF as PNG first.`); continue; }
    }
    const url = await readAsDataURL(blob);
    const up = await uploadAsset("stamp", f.name.replace(/\.\w+$/, ""), url);
    if ("id" in up) { list.push({ id: up.id, url, serverId: up.id }); saved++; }
    else { list.push({ id: crypto.randomUUID(), url }); local++; why = up.error; }
  }
  setCustomStamps(list);
  const cached = await kvSet("stamps", list).catch(() => false);
  if (!saved && !local) return;
  setStatus(local
    ? `${local} stamp${local > 1 ? "s" : ""} added for ${cached ? "this computer" : "this session"} only — ${why}${saved ? ` (${saved} saved to your account.)` : ""}`
    : "Stamps added — saved to your account library.");
}

/* Drop a built-in SFX stamp on the page. It is fetched once and then kept in
   the local artwork store like any other image, so the page still renders it
   after a refresh without going back to the network. */
export async function insertSfxStamp(ed: EditorCtx, slug: string, label: string) {
  const { aidRef, setStampOpen, setStatus } = ed;
  setStampOpen(false);
  try {
    const res = await fetch(`/stamps/${slug}.png`);
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const aid = nextAid(ed);
    const url = await stashArt(ed, aid, blob);
    const img = await loadImage(url);
    placeAsset(ed, aid, img.naturalWidth, img.naturalHeight, undefined, undefined, true);
  } catch {
    setStatus(`Could not load the “${label}” stamp.`);
  }
}

export async function insertCustomStamp(ed: EditorCtx, url: string) {
  const { aidRef, setStampOpen } = ed;
  const img = await loadImage(url);
  const aid = nextAid(ed);
  await stashDataUrl(ed, aid, url);
  placeAsset(ed, aid, img.naturalWidth, img.naturalHeight, undefined, undefined, true);
  setStampOpen(false);
}

export function removeCustomStamp(ed: EditorCtx, id: string) {
  const { customStamps, setCustomStamps } = ed;
  const gone = customStamps.find((s) => s.id === id);
  if (gone?.serverId) fetch(`/api/assets/${gone.serverId}`, { method: "DELETE" }).catch(() => { });
  const list = customStamps.filter((s) => s.id !== id);
  setCustomStamps(list);
  kvSet("stamps", list).catch(() => { });
}

