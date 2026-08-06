"use client";
/* The adjustment-layer editor dialog — Photoshop-style per-tool panels:
   an interactive point-drag graph for Curves, a live page histogram with
   input/output carets for Levels, a six-hue mixer with Auto for Black &
   White, preset filters for Photo Filter, and gradient-track sliders
   everywhere else. Opened when a tool adds a layer and by double-clicking
   the layer in the Layers panel.

   All widgets read/write the SAME params the shared filter engine
   (lib/pageAdjust) compiles, so the preview, the canvas and the exports
   can never disagree. */
import React, { useEffect, useState } from "react";
import { AdjustEl, clamp } from "@/lib/model";
import {
  ADJUST_META, AdjustParamSpec, GRADIENT_MAPS, LOOKUP_TABLE, SEL_FAMILIES,
  gradientStops, parseCurve, sampleCurve, serializeCurve,
} from "@/lib/pageAdjust";
import { renderPageToCanvas } from "@/lib/exportPng";
import { EditorCtx } from "./ctx";

const numOf = (v: number | string | undefined, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

/* ---------------- Curves: the point-drag graph ---------------- */

function CurveGraph({ ed, el }: { ed: EditorCtx; el: AdjustEl }) {
  const W = 256, H = 200, P = 10;
  const pts = parseCurve(el.params.pts);
  const samples = sampleCurve(pts, 65);
  const path = samples.map((y, i) => `${i ? "L" : "M"}${(P + (i / 64) * W).toFixed(1)} ${(P + (1 - y) * H).toFixed(1)}`).join(" ");
  const write = (next: [number, number][], final: boolean) => {
    el.params = { ...el.params, pts: serializeCurve(next) };
    if (final) ed.commit(); else ed.force();
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const toXY = (ev: { clientX: number; clientY: number }): [number, number] => [
      clamp(((ev.clientX - rect.left) / rect.width * (W + 2 * P) - P) / W, 0, 1),
      clamp(1 - ((ev.clientY - rect.top) / rect.height * (H + 2 * P) - P) / H, 0, 1),
    ];
    let cur = parseCurve(el.params.pts);
    const [px, py] = toXY(e);
    let idx = cur.findIndex(([x, y]) => Math.hypot(x - px, y - py) < 0.06);
    if (idx < 0) {
      if (cur.length >= 12) return;
      cur = [...cur, [px, py] as [number, number]].sort((a, b) => a[0] - b[0]);
      idx = cur.findIndex(([x, y]) => x === px && y === py);
      write(cur, false);
    }
    let alive = true;
    const move = (ev: PointerEvent) => {
      if (!alive) return;
      const [nx, ny] = toXY(ev);
      const isEnd = idx === 0 || idx === cur.length - 1;
      /* dragging a middle point well off the graph removes it, like PS */
      if (!isEnd && (ev.clientY < rect.top - 36 || ev.clientY > rect.bottom + 36)) {
        cur = cur.filter((_, i) => i !== idx);
        alive = false;
        write(cur, false);
        return;
      }
      const lo = idx > 0 ? cur[idx - 1][0] + 0.02 : 0;
      const hi = idx < cur.length - 1 ? cur[idx + 1][0] - 0.02 : 1;
      cur = cur.map((q, i) =>
        i === idx ? [isEnd ? q[0] : clamp(nx, lo, hi), ny] as [number, number] : q);
      write(cur, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      write(cur, true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="curveWrap">
      <svg viewBox={`0 0 ${W + 2 * P} ${H + 2 * P}`} className="curveSvg" onPointerDown={down}>
        <rect x={P} y={P} width={W} height={H} className="cvBg" />
        {[1, 2, 3].map((i) => (
          <React.Fragment key={i}>
            <line x1={P + (W * i) / 4} y1={P} x2={P + (W * i) / 4} y2={P + H} className="cvGrid" />
            <line x1={P} y1={P + (H * i) / 4} x2={P + W} y2={P + (H * i) / 4} className="cvGrid" />
          </React.Fragment>
        ))}
        <line x1={P} y1={P + H} x2={P + W} y2={P} className="cvDiag" />
        <path d={path} className="cvCurve" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={P + x * W} cy={P + (1 - y) * H} r={5} className="cvPt" />
        ))}
      </svg>
      <div className="tips">Click the line to add a point, drag points to shape the curve, drag a middle point off the graph to remove it.</div>
    </div>
  );
}

/* ---------------- Levels: histogram + input/output carets ---------------- */

function usePageHistogram(ed: EditorCtx): number[] | null {
  const [hist, setHist] = useState<number[] | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      const pg = ed.page;
      if (!pg) return;
      try {
        /* histogram of the page CONTENT (adjustment layers stripped), small */
        const cv = await renderPageToCanvas(
          { ...pg, els: pg.els.filter((e) => e.type !== "adjust") },
          ed.assetsRef.current, 140 / pg.w);
        const cx = cv.getContext("2d", { willReadFrequently: true })!;
        const data = cx.getImageData(0, 0, cv.width, cv.height).data;
        const bins = new Array(64).fill(0);
        for (let i = 0; i < data.length; i += 4) {
          const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          bins[Math.min(63, Math.round(l) >> 2)]++;
        }
        const max = Math.max(...bins, 1);
        if (!dead) setHist(bins.map((v) => Math.sqrt(v / max)));
      } catch { if (!dead) setHist([]); }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return hist;
}

function LevelsPanel({ ed, el }: { ed: EditorCtx; el: AdjustEl }) {
  const hist = usePageHistogram(ed);
  const W = 276, H = 110;
  const p = el.params;
  const set = (patch: Record<string, number>, final: boolean) => {
    el.params = { ...el.params, ...patch };
    if (final) ed.commit(); else ed.force();
  };
  /* caret positions on the 0..1 input axis */
  const bx = clamp(numOf(p.blacks, 0), 0, 100) / 200;
  const wx = 1 - clamp(numOf(p.whites, 0), 0, 100) / 200;
  const gamma = clamp(numOf(p.gamma, 1), 0.2, 2.4);
  const gt = clamp(0.5 - Math.log2(gamma) / 2.2, 0.02, 0.98);
  const gx = bx + (wx - bx) * gt;
  const ob = clamp(numOf(p.outB, 0), 0, 255) / 255;
  const ow = clamp(numOf(p.outW, 255), 0, 255) / 255;
  const dragStrip = (e: React.PointerEvent<SVGSVGElement>, output: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const toX = (ev: { clientX: number }) => clamp((ev.clientX - rect.left) / rect.width, 0, 1);
    const x0 = toX(e);
    /* nearest caret wins the drag */
    const which = output
      ? (Math.abs(x0 - ob) <= Math.abs(x0 - ow) ? "ob" : "ow")
      : [["b", Math.abs(x0 - bx)], ["g", Math.abs(x0 - gx)], ["w", Math.abs(x0 - wx)]]
        .sort((a, b) => (a[1] as number) - (b[1] as number))[0][0];
    const move = (ev: PointerEvent) => {
      const x = toX(ev);
      if (which === "b") set({ blacks: clamp(x, 0, 0.49) * 200 }, false);
      else if (which === "w") set({ whites: clamp(1 - x, 0, 0.49) * 200 }, false);
      else if (which === "g") {
        const t = clamp((x - bx) / Math.max(0.02, wx - bx), 0.02, 0.98);
        set({ gamma: clamp(Math.pow(2, (0.5 - t) * 2.2), 0.2, 2.4) }, false);
      }
      else if (which === "ob") set({ outB: Math.round(clamp(x, 0, ow - 0.02) * 255) }, false);
      else set({ outW: Math.round(clamp(x, ob + 0.02, 1) * 255) }, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      ed.commit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const caret = (x: number, cls: string) => (
    <path d={`M${(x * W).toFixed(1)} 2 l6 10 h-12 Z`} className={cls} />
  );
  return (
    <div className="levelsWrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="levelsHist">
        <rect x={0} y={0} width={W} height={H} className="cvBg" />
        {hist === null && <text x={W / 2} y={H / 2} className="lvBusy">reading the page…</text>}
        {hist?.map((v, i) => (
          <rect key={i} x={(i / 64) * W} y={H - v * (H - 6)} width={W / 64 + 0.5} height={v * (H - 6)} className="lvBar" />
        ))}
      </svg>
      <svg viewBox={`0 0 ${W} 14`} className="levelsStrip" onPointerDown={(e) => dragStrip(e, false)}>
        {caret(bx, "lvCaret dark")}{caret(gx, "lvCaret mid")}{caret(wx, "lvCaret light")}
      </svg>
      <div className="lvNums">
        <span>{Math.round(bx * 2 * 127.5)}</span>
        <span>{gamma.toFixed(2)}</span>
        <span>{Math.round(wx * 255)}</span>
      </div>
      <div className="lvRamp" />
      <svg viewBox={`0 0 ${W} 14`} className="levelsStrip" onPointerDown={(e) => dragStrip(e, true)}>
        {caret(ob, "lvCaret dark")}{caret(ow, "lvCaret light")}
      </svg>
      <div className="lvNums">
        <span>Output: {Math.round(ob * 255)}</span>
        <span />
        <span>{Math.round(ow * 255)}</span>
      </div>
      <div className="tips">Drag the carets: blacks, midtones and whites in; the lower pair remaps the output range.</div>
    </div>
  );
}

/* ---------------- Threshold: histogram + one caret ---------------- */

function ThresholdPanel({ ed, el }: { ed: EditorCtx; el: AdjustEl }) {
  const hist = usePageHistogram(ed);
  const W = 276, H = 110;
  const lvl = clamp(numOf(el.params.level, 50), 1, 99) / 100;
  const set = (v: number, final: boolean) => {
    el.params = { ...el.params, level: clamp(v, 1, 99) };
    if (final) ed.commit(); else ed.force();
  };
  const drag = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const toX = (ev: { clientX: number }) => clamp((ev.clientX - rect.left) / rect.width, 0, 1);
    const move = (ev: PointerEvent) => set(toX(ev) * 100, false);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      ed.commit();
    };
    set(toX(e) * 100, false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className="levelsWrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="levelsHist">
        <rect x={0} y={0} width={W} height={H} className="cvBg" />
        {hist === null && <text x={W / 2} y={H / 2} className="lvBusy">reading the page…</text>}
        {hist?.map((v, i) => (
          <rect key={i} x={(i / 64) * W} y={H - v * (H - 6)} width={W / 64 + 0.5} height={v * (H - 6)} className="lvBar" />
        ))}
        <line x1={lvl * W} y1={0} x2={lvl * W} y2={H} stroke="#2f7fd6" strokeWidth={1.5} />
      </svg>
      <svg viewBox={`0 0 ${W} 14`} className="levelsStrip" onPointerDown={drag}>
        <path d={`M${(lvl * W).toFixed(1)} 2 l6 10 h-12 Z`} className="lvCaret mid" />
      </svg>
      <div className="adjRow">
        <label>Threshold level</label>
        <input type="number" className="adjNum" min={1} max={254}
          value={Math.round(lvl * 255)}
          onChange={(e) => set(clamp(+e.target.value || 128, 1, 254) / 255 * 100, true)} />
      </div>
      <div className="tips">Everything darker than the caret goes black, everything lighter goes white.</div>
    </div>
  );
}

/* ---------------- Black & White: Auto from the page ---------------- */

async function autoBW(ed: EditorCtx, el: AdjustEl) {
  const pg = ed.page;
  if (!pg) return;
  ed.setStatus("Reading the page for the best black & white mix…");
  try {
    const cv = await renderPageToCanvas(
      { ...pg, els: pg.els.filter((e) => e.type !== "adjust") },
      ed.assetsRef.current, 140 / pg.w);
    const cx = cv.getContext("2d", { willReadFrequently: true })!;
    const data = cx.getImageData(0, 0, cv.width, cv.height).data;
    /* how much of the page lives in each hue family, saturation-weighted */
    const pres = [0, 0, 0, 0, 0, 0];   // R Y G C B M
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const s = mx - mn;
      if (s < 24) continue;            // near-gray says nothing about hue
      let h = 0;
      if (mx === r) h = ((g - b) / s + 6) % 6;
      else if (mx === g) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      pres[Math.round(h) % 6] += s / 255;
    }
    /* equalise: sparse hues get pull so the conversion keeps separation */
    const total = pres.reduce((a, v) => a + v, 0) || 1;
    const keys = ["reds", "yellows", "greens", "cyans", "blues", "magentas"];
    const patch: Record<string, number> = {};
    keys.forEach((k, i) => {
      const share = pres[i] / total;
      patch[k] = Math.round(clamp(30 + share * 180, -100, 200));
    });
    el.params = { ...el.params, ...patch };
    ed.commit();
    ed.setStatus("Auto black & white mix set from this page's colors — fine-tune the sliders.");
  } catch {
    ed.setStatus("Could not read the page's pixels for Auto — adjust the sliders by hand.");
  }
}

/* ---------------- Channel Mixer: output channel + presets ---------------- */

const MIXER_PRESETS: [string, Record<string, number>][] = [
  ["Default", { rr: 100, rg: 0, rb: 0, rk: 0, gr: 0, gg: 100, gb: 0, gk: 0, br: 0, bg: 0, bb: 100, bk: 0, mono: 0 }],
  ["Black & White Infrared (RGB)", { rr: -70, rg: 200, rb: -30, rk: 0, mono: 1 }],
  ["Black & White with Blue Filter (RGB)", { rr: 0, rg: 0, rb: 100, rk: 0, mono: 1 }],
  ["Black & White with Green Filter (RGB)", { rr: 40, rg: 60, rb: 0, rk: 0, mono: 1 }],
  ["Black & White with Orange Filter (RGB)", { rr: 50, rg: 50, rb: 0, rk: 0, mono: 1 }],
  ["Black & White with Red Filter (RGB)", { rr: 100, rg: 0, rb: 0, rk: 0, mono: 1 }],
  ["Black & White with Yellow Filter (RGB)", { rr: 34, rg: 66, rb: 0, rk: 0, mono: 1 }],
];

function ChannelMixerPanel({ ed, el }: { ed: EditorCtx; el: AdjustEl }) {
  const [outCh, setOutCh] = useState<"r" | "g" | "b">("r");
  const p = el.params;
  const mono = !!numOf(p.mono, 0);
  const ch = mono ? "r" : outCh;
  const set = (patch: Record<string, number>, final: boolean) => {
    el.params = { ...el.params, ...patch };
    if (final) ed.commit(); else ed.force();
  };
  const key = (srcC: string) => `${ch}${srcC}`;
  const val = (srcC: string, d: number) => numOf(p[key(srcC)], d);
  const defFor = (srcC: string) => (!mono && srcC === ch ? 100 : 0);
  const total = val("r", defFor("r")) + val("g", defFor("g")) + val("b", defFor("b"));
  const row = (srcC: "r" | "g" | "b", label: string, track: string) => (
    <div className="adjRow" key={srcC}>
      <label>{label}</label>
      <input type="range" min={-200} max={200} className="adjTrack" style={{ background: track }}
        value={val(srcC, defFor(srcC))}
        onChange={(e) => set({ [key(srcC)]: +e.target.value }, false)}
        onPointerUp={() => ed.commit()} />
      <input type="number" className="adjNum" min={-200} max={200}
        value={val(srcC, defFor(srcC))}
        onChange={(e) => set({ [key(srcC)]: clamp(+e.target.value || 0, -200, 200) }, true)} />
    </div>
  );
  return (
    <>
      <div className="adjRow">
        <label>Preset</label>
        <select style={{ flex: 1 }} value="pick" onChange={(e) => {
          const hit = MIXER_PRESETS.find(([n]) => n === e.target.value);
          if (hit) set({ ...MIXER_PRESETS[0][1], ...hit[1] }, true);
        }}>
          <option value="pick" disabled>Choose a preset…</option>
          {MIXER_PRESETS.map(([n]) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="adjRow">
        <label>Output channel</label>
        <select style={{ flex: 1 }} value={mono ? "gray" : outCh} disabled={mono}
          onChange={(e) => setOutCh(e.target.value as "r" | "g" | "b")}>
          {mono ? <option value="gray">Gray</option> : (
            <>
              <option value="r">Red</option>
              <option value="g">Green</option>
              <option value="b">Blue</option>
            </>
          )}
        </select>
      </div>
      <div className="adjRow">
        <label>Monochrome</label>
        <input type="checkbox" checked={mono}
          onChange={(e) => set({ mono: e.target.checked ? 1 : 0 }, true)} />
      </div>
      {row("r", "Red", "linear-gradient(90deg,#000,#e00,#ffd9d9)")}
      {row("g", "Green", "linear-gradient(90deg,#000,#0c0,#d9ffd9)")}
      {row("b", "Blue", "linear-gradient(90deg,#000,#22e,#d9d9ff)")}
      <div className="adjRow">
        <label>Total</label>
        <span style={{ flex: 1, fontSize: 13, color: Math.abs(total - 100) > 40 ? "#b34" : "#556" }}>
          {total > 0 ? "+" : ""}{total}%
        </span>
      </div>
      <div className="adjRow">
        <label>Constant</label>
        <input type="range" min={-200} max={200} className="adjTrack"
          style={{ background: "linear-gradient(90deg,#000,#8a8a8a,#fff)" }}
          value={val("k", 0)}
          onChange={(e) => set({ [key("k")]: +e.target.value }, false)}
          onPointerUp={() => ed.commit()} />
        <input type="number" className="adjNum" min={-200} max={200} value={val("k", 0)}
          onChange={(e) => set({ [key("k")]: clamp(+e.target.value || 0, -200, 200) }, true)} />
      </div>
    </>
  );
}

/* ---------------- Selective Color: family picker + presets ---------------- */

const SEL_PRESETS: [string, Record<string, number>][] = [
  ["Default", {}],
  ["Deep Sky", { blu_c: 30, blu_k: 20, cyn_c: 15 }],
  ["Lush Foliage", { grn_c: 25, grn_y: 30, yel_y: 20 }],
  ["Warm Skin", { red_c: -10, red_y: 10, yel_m: -5 }],
  ["Pure Whites", { wht_k: -20, wht_y: -8 }],
  ["Rich Blacks", { blk_k: 25, neu_k: 8 }],
];
const SEL_CHIPS: Record<string, string> = {
  red: "#d22", yel: "#e6c800", grn: "#2a2", cyn: "#4cf", blu: "#22e",
  mag: "#d2d", wht: "#fff", neu: "#9a9a9a", blk: "#111",
};

function SelectiveColorPanel({ ed, el }: { ed: EditorCtx; el: AdjustEl }) {
  const [fam, setFam] = useState("red");
  const p = el.params;
  const set = (patch: Record<string, number>, final: boolean) => {
    el.params = { ...el.params, ...patch };
    if (final) ed.commit(); else ed.force();
  };
  const zeroAll = (): Record<string, number> => {
    const z: Record<string, number> = {};
    for (const [f] of SEL_FAMILIES) for (const ch of ["c", "m", "y", "k"]) z[`${f}_${ch}`] = 0;
    return z;
  };
  const row = (ch: "c" | "m" | "y" | "k", label: string, track: string) => (
    <div className="adjRow" key={ch}>
      <label>{label}</label>
      <input type="range" min={-100} max={100} className="adjTrack" style={{ background: track }}
        value={numOf(p[`${fam}_${ch}`], 0)}
        onChange={(e) => set({ [`${fam}_${ch}`]: +e.target.value }, false)}
        onPointerUp={() => ed.commit()} />
      <input type="number" className="adjNum" min={-100} max={100}
        value={numOf(p[`${fam}_${ch}`], 0)}
        onChange={(e) => set({ [`${fam}_${ch}`]: clamp(+e.target.value || 0, -100, 100) }, true)} />
    </div>
  );
  return (
    <>
      <div className="adjRow">
        <label>Preset</label>
        <select style={{ flex: 1 }} value="pick" onChange={(e) => {
          const hit = SEL_PRESETS.find(([n]) => n === e.target.value);
          if (hit) set({ ...zeroAll(), ...hit[1] }, true);
        }}>
          <option value="pick" disabled>Choose a preset…</option>
          {SEL_PRESETS.map(([n]) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="adjRow">
        <label>Colors</label>
        <span className="selChip" style={{ background: SEL_CHIPS[fam] }} />
        <select style={{ flex: 1 }} value={fam} onChange={(e) => setFam(e.target.value)}>
          {SEL_FAMILIES.map(([f, name]) => <option key={f} value={f}>{name}</option>)}
        </select>
      </div>
      {row("c", "Cyan", "linear-gradient(90deg,#e33,#9b9b9b 50%,#0ff)")}
      {row("m", "Magenta", "linear-gradient(90deg,#2c2,#9b9b9b 50%,#e3e)")}
      {row("y", "Yellow", "linear-gradient(90deg,#33e,#9b9b9b 50%,#ee0)")}
      {row("k", "Black", "linear-gradient(90deg,#fff,#9b9b9b 50%,#000)")}
      <div className="adjRow">
        <label>Method</label>
        <label style={{ flex: 0, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="radio" name="selmethod" checked={!numOf(p.method, 0)}
            onChange={() => set({ method: 0 }, true)} /> Relative
        </label>
        <label style={{ flex: 0, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="radio" name="selmethod" checked={!!numOf(p.method, 0)}
            onChange={() => set({ method: 1 }, true)} /> Absolute
        </label>
      </div>
    </>
  );
}

/* ---------------- Gradient Map: preview + grouped preset picker ---------------- */

function GradientMapPanel({ ed, el }: { ed: EditorCtx; el: AdjustEl }) {
  const p = el.params;
  const set = (patch: Record<string, number | string>, final: boolean) => {
    el.params = { ...el.params, ...patch };
    if (final) ed.commit(); else ed.force();
  };
  const preset = typeof p.preset === "string" ? p.preset : "Crimson";
  let stops = (preset !== "Custom" && gradientStops(preset)) ||
    [String(p.a ?? "#1a1240"), String(p.b ?? "#ffcf6b")];
  if (numOf(p.rev, 0)) stops = [...stops].reverse();
  return (
    <>
      <div className="gmapBar" style={{ background: `linear-gradient(90deg, ${stops.join(", ")})` }} />
      <div className="adjRow">
        <label>Gradient</label>
        <select style={{ flex: 1 }} value={preset}
          onChange={(e) => set({ preset: e.target.value }, true)}>
          {Object.entries(GRADIENT_MAPS).map(([group, list]) => (
            <optgroup key={group} label={group}>
              {list.map(([n]) => <option key={n} value={n}>{n}</option>)}
            </optgroup>
          ))}
          <optgroup label="Custom">
            <option value="Custom">Custom (two colors below)</option>
          </optgroup>
        </select>
      </div>
      {preset === "Custom" && (
        <>
          <div className="adjRow">
            <label>Shadows color</label>
            <input type="color" value={String(p.a ?? "#1a1240")} onChange={(e) => set({ a: e.target.value }, true)} />
          </div>
          <div className="adjRow">
            <label>Highlights color</label>
            <input type="color" value={String(p.b ?? "#ffcf6b")} onChange={(e) => set({ b: e.target.value }, true)} />
          </div>
        </>
      )}
      <div className="adjRow">
        <label>Reverse</label>
        <input type="checkbox" checked={!!numOf(p.rev, 0)}
          onChange={(e) => set({ rev: e.target.checked ? 1 : 0 }, true)} />
      </div>
      <div className="adjRow">
        <label>Method</label>
        <select style={{ flex: 1 }} value={String(p.method ?? "Smooth")}
          onChange={(e) => set({ method: e.target.value }, true)}>
          {["Smooth", "Linear", "Classic", "Perceptual", "Stripes"].map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="adjRow">
        <label>Blend</label>
        <input type="range" min={0} max={100} value={numOf(p.amt, 100)}
          onChange={(e) => set({ amt: +e.target.value }, false)}
          onPointerUp={() => ed.commit()} />
        <input type="number" className="adjNum" min={0} max={100} value={numOf(p.amt, 100)}
          onChange={(e) => set({ amt: clamp(+e.target.value || 0, 0, 100) }, true)} />
      </div>
    </>
  );
}

/* ---------------- Photo Filter presets (the classic Photoshop list) ---------------- */

const PHOTO_PRESETS: [string, string][] = [
  ["Warming Filter (85)", "#ec8a00"], ["Warming Filter (LBA)", "#fa9600"],
  ["Warming Filter (81)", "#ebb113"], ["Cooling Filter (80)", "#006dff"],
  ["Cooling Filter (LBB)", "#005dff"], ["Cooling Filter (82)", "#00b5ff"],
  ["Red", "#ea1a1a"], ["Orange", "#f38417"], ["Yellow", "#f9e31c"],
  ["Green", "#19c919"], ["Cyan", "#1cadb9"], ["Blue", "#1d35ea"],
  ["Violet", "#9b30ff"], ["Magenta", "#e318e3"], ["Sepia", "#ac7a33"],
  ["Deep Red", "#ff0000"], ["Deep Blue", "#0022cd"], ["Deep Emerald", "#008c00"],
  ["Deep Yellow", "#ffd500"], ["Underwater", "#00c1b1"],
];

/* ---------------- the dialog ---------------- */

export function renderAdjustDialog(ed: EditorCtx) {
  const id = ed.adjustEdit;
  const page = ed.page;
  if (!id || !page) return null;
  const el = page.els.find((x) => x.id === id);
  if (!el || el.type !== "adjust") return null;
  const meta = ADJUST_META[el.kind];
  const set = (k: string, v: number | string, final: boolean) => {
    el.params = { ...el.params, [k]: v };
    if (final) ed.commit(); else ed.force();
  };
  const done = () => { ed.setAdjustEdit(null); ed.commit(); };
  const sliderRow = (spec: AdjustParamSpec) => (
    <div key={spec.key} className="adjRow">
      <label>{spec.label}</label>
      {spec.color ? (
        <input type="color" value={String(el.params[spec.key] ?? spec.def)}
          onChange={(e) => set(spec.key, e.target.value, true)} />
      ) : (
        <>
          <input type="range" min={spec.min} max={spec.max} step={spec.step ?? 1}
            className={spec.track ? "adjTrack" : undefined}
            style={spec.track ? { background: spec.track } : undefined}
            value={Number(el.params[spec.key] ?? spec.def)}
            onChange={(e) => set(spec.key, +e.target.value, false)}
            onPointerUp={() => ed.commit()} />
          <input type="number" className="adjNum" min={spec.min} max={spec.max} step={spec.step ?? 1}
            value={Number(el.params[spec.key] ?? spec.def)}
            onChange={(e) => set(spec.key, clamp(+e.target.value || 0, spec.min ?? -1e9, spec.max ?? 1e9), true)} />
        </>
      )}
    </div>
  );
  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) done(); }}>
      <div className="setupDlg" style={{ width: 400 }}>
        <div className="setupTitle">✨ {meta.label}</div>
        <div className="setupBody" style={{ flexDirection: "column", gap: 10 }}>
          {el.kind === "curves" ? (
            <CurveGraph ed={ed} el={el} />
          ) : el.kind === "levels" ? (
            <LevelsPanel ed={ed} el={el} />
          ) : el.kind === "threshold" ? (
            <ThresholdPanel ed={ed} el={el} />
          ) : el.kind === "gradientmap" ? (
            <GradientMapPanel ed={ed} el={el} />
          ) : el.kind === "channelmixer" ? (
            <ChannelMixerPanel ed={ed} el={el} />
          ) : el.kind === "selectivecolor" ? (
            <SelectiveColorPanel ed={ed} el={el} />
          ) : el.kind === "colorlookup" ? (
            <>
              <div className="adjRow">
                <label>Look</label>
                <select style={{ flex: 1 }} value={String(el.params.look ?? "Teal & Orange")}
                  onChange={(e) => set("look", e.target.value, true)}>
                  {Object.keys(LOOKUP_TABLE).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {meta.params.filter((s) => s.key === "strength").map(sliderRow)}
            </>
          ) : (
            <>
              {el.kind === "bw" && (
                <div className="btnRow" style={{ justifyContent: "flex-end" }}>
                  <button onClick={() => autoBW(ed, el)}
                    title="Read this page's colors and set the mix that keeps them best separated in gray">Auto</button>
                </div>
              )}
              {el.kind === "photofilter" && (
                <div className="adjRow">
                  <label>Filter</label>
                  <select style={{ flex: 1 }}
                    value={(PHOTO_PRESETS.find(([, c]) => c === el.params.color)?.[0]) ?? "custom"}
                    onChange={(e) => {
                      const hit = PHOTO_PRESETS.find(([n]) => n === e.target.value);
                      if (hit) set("color", hit[1], true);
                    }}>
                    {PHOTO_PRESETS.map(([n]) => <option key={n} value={n}>{n}</option>)}
                    <option value="custom">Custom color…</option>
                  </select>
                </div>
              )}
              {meta.params.map(sliderRow)}
            </>
          )}
          <div style={{ fontSize: 12, color: "#667" }}>
            This layer grades the whole page. Its eyeball in the Layers panel
            switches the grade off; double-click the layer to reopen this.
          </div>
        </div>
        <div className="setupFoot">
          <button onClick={() => {
            page.els = page.els.filter((x) => x.id !== id);
            ed.setAdjustEdit(null);
            ed.commit();
          }}>Delete Layer</button>
          <button className="okBtn" onClick={done}>Done</button>
        </div>
      </div>
    </div>
  );
}
