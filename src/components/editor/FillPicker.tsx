"use client";
/* ComicLettering Studio — fill picker (solid/gradient/halftone/tiles/
   speedlines/texture), split out of Editor.tsx (module-level code, unchanged). */
import {
  FillStyle, GRADIENT_PRESETS, HALFTONE_VARIANTS, PATTERN_VARIANTS,
  SPEEDLINE_VARIANTS, TEXTURE_VARIANTS,
} from "@/lib/model";
import { defaultFillFor, fillOverlayURL, isRepeating } from "@/lib/fills";

/* ---------------- fill picker ---------------- */

const FILL_KINDS: { k: FillStyle["kind"]; label: string }[] = [
  { k: "solid", label: "Solid" }, { k: "gradient", label: "Gradient" },
  { k: "halftone", label: "Halftone" }, { k: "pattern", label: "Tiles" },
  { k: "speedlines", label: "Speedlines" }, { k: "texture", label: "Texture" },
];

export function FillPicker({ value, onChange }: { value: FillStyle; onChange: (f: FillStyle, final: boolean) => void }) {
  const v = value;
  const set = (patch: Partial<FillStyle>, final = true) =>
    onChange({ ...v, ...patch } as FillStyle, final);

  const variantSwatches = (variants: Record<string, string>, current: string, build: (key: string) => FillStyle) => (
    <div className="variantGrid">
      {Object.entries(variants).map(([key, label]) => {
        const f = build(key);
        const url = fillOverlayURL(f);
        return (
          <button
            key={key}
            title={label}
            className={"variantBtn" + (current === key ? " on" : "")}
            style={{
              backgroundColor: "#ffffff",
              backgroundImage: url ? `url(${url})` : undefined,
              backgroundSize: isRepeating(f) ? "auto" : "100% 100%",
            }}
            onClick={() => onChange(f, true)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="fillPicker">
      <div className="fld">
        <label>Fill type</label>
        <select value={v.kind} onChange={(e) => onChange(defaultFillFor(e.target.value as FillStyle["kind"], "a" in v ? v.a : "#ffffff"), true)}>
          {FILL_KINDS.map((f) => <option key={f.k} value={f.k}>{f.label}</option>)}
        </select>
      </div>
      <div className="fld">
        <label>{v.kind === "gradient" ? "Top" : "Base"}</label>
        <input type="color" value={v.a} onInput={(e) => set({ a: (e.target as HTMLInputElement).value }, false)} onChange={(e) => set({ a: e.target.value })} />
      </div>
      {v.kind === "gradient" && (
        <>
          <div className="fld">
            <label>Bottom</label>
            <input type="color" value={v.b} onInput={(e) => set({ b: (e.target as HTMLInputElement).value } as Partial<FillStyle>, false)} onChange={(e) => set({ b: e.target.value } as Partial<FillStyle>)} />
          </div>
          <div className="fld">
            <label>Angle</label>
            <input type="range" min={0} max={360} value={v.angle} onChange={(e) => set({ angle: +e.target.value } as Partial<FillStyle>)} />
          </div>
          <div className="variantGrid">
            {GRADIENT_PRESETS.map(([a, b], i) => (
              <button key={i} className="variantBtn" style={{ background: `linear-gradient(180deg, ${a}, ${b})` }}
                onClick={() => onChange({ kind: "gradient", a, b, angle: 180 }, true)} />
            ))}
          </div>
        </>
      )}
      {v.kind === "halftone" && (
        <>
          <div className="fld"><label>Dots</label>
            <input type="color" value={v.dot} onChange={(e) => set({ dot: e.target.value } as Partial<FillStyle>)} /></div>
          <div className="fld"><label>Cell</label>
            <select value={v.cell} onChange={(e) => set({ cell: +e.target.value as 8 | 16 | 32 } as Partial<FillStyle>)}>
              <option value={8}>Fine (8)</option><option value={16}>Medium (16)</option><option value={32}>Coarse (32)</option>
            </select></div>
          {variantSwatches(HALFTONE_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
      {v.kind === "pattern" && (
        <>
          <div className="fld"><label>Ink</label>
            <input type="color" value={v.fg} onChange={(e) => set({ fg: e.target.value } as Partial<FillStyle>)} /></div>
          <div className="fld"><label>Scale</label>
            <input type="range" min={8} max={64} value={v.scale} onChange={(e) => set({ scale: +e.target.value } as Partial<FillStyle>)} /></div>
          {variantSwatches(PATTERN_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
      {v.kind === "speedlines" && (
        <>
          <div className="fld"><label>Lines</label>
            <input type="color" value={v.line} onChange={(e) => set({ line: e.target.value } as Partial<FillStyle>)} /></div>
          {variantSwatches(SPEEDLINE_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
      {v.kind === "texture" && (
        <>
          <div className="fld"><label>Grain</label>
            <input type="color" value={v.fg} onChange={(e) => set({ fg: e.target.value } as Partial<FillStyle>)} /></div>
          {variantSwatches(TEXTURE_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
    </div>
  );
}
