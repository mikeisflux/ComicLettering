"use client";
/* Custom gradient maker — build a ramp of your own, save it to the library
   and reuse it. Stops are dragged along the bar, double-clicked to add and
   removed with the button; the result is the same GradStop[] the built-in
   multi-tier gradients use, so it feeds fills, lettering and export alike. */
import { useEffect, useRef, useState } from "react";
import { GradStop } from "@/lib/model";

export const CUSTOM_GRADS_KEY = "lmc.gradients";

export interface CustomGrad { name: string; stops: GradStop[] }

export const gradCss = (stops: GradStop[], angle = 180) =>
  `linear-gradient(${angle}deg, ${[...stops]
    .sort((a, b) => a[1] - b[1])
    .map(([c, p]) => `${c} ${Math.round(p * 100)}%`)
    .join(", ")})`;

export function loadCustomGrads(): CustomGrad[] {
  try {
    const raw = localStorage.getItem(CUSTOM_GRADS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((g) => g?.name && Array.isArray(g.stops)) : [];
  } catch { return []; }
}

export function saveCustomGrads(list: CustomGrad[]) {
  try { localStorage.setItem(CUSTOM_GRADS_KEY, JSON.stringify(list)); } catch { /* cache only */ }
}

const DEFAULT_STOPS: GradStop[] = [["#ffe14d", 0], ["#ff7a00", 0.55], ["#c01800", 1]];

export function GradientMaker({ initial, onApply, onClose, onSaved }: {
  initial?: GradStop[];
  onApply: (stops: GradStop[]) => void;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [stops, setStops] = useState<GradStop[]>(
    initial && initial.length >= 2 ? initial.map((s) => [...s] as GradStop) : DEFAULT_STOPS.map((s) => [...s] as GradStop));
  const [sel, setSel] = useState(0);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<CustomGrad[]>([]);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSaved(loadCustomGrads()); }, []);

  const ordered = [...stops].map((s, i) => ({ s, i })).sort((a, b) => a.s[1] - b.s[1]);
  const setStop = (i: number, patch: Partial<{ c: string; p: number }>) =>
    setStops((old) => old.map((s, k) => k !== i ? s
      : [patch.c ?? s[0], patch.p === undefined ? s[1] : Math.min(1, Math.max(0, patch.p))] as GradStop));

  const posFromEvent = (clientX: number) => {
    const r = barRef.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const dragStop = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSel(i);
    const move = (ev: PointerEvent) => setStop(i, { p: posFromEvent(ev.clientX) });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const addStop = (e: React.MouseEvent) => {
    const p = posFromEvent(e.clientX);
    setStops((old) => {
      /* new stop takes the colour the ramp already shows there, so adding one
         never changes how the gradient looks — only what you can steer */
      const sorted = [...old].sort((a, b) => a[1] - b[1]);
      const after = sorted.find((s) => s[1] >= p) ?? sorted[sorted.length - 1];
      setSel(old.length);
      return [...old, [after[0], p] as GradStop];
    });
  };

  const removeStop = () => {
    if (stops.length <= 2) return;
    setStops((old) => old.filter((_, k) => k !== sel));
    setSel(0);
  };

  const current = stops[sel] ?? stops[0];
  const sortedStops = [...stops].sort((a, b) => a[1] - b[1]);

  const save = () => {
    const nm = (name.trim() || "My gradient").slice(0, 40);
    const list = [...saved.filter((g) => g.name !== nm), { name: nm, stops: sortedStops }];
    saveCustomGrads(list);
    setSaved(list);
    setName("");
    onSaved?.();
  };

  return (
    <div className="modalBack" onClick={onClose}>
      <div className="modal gradMaker" onClick={(e) => e.stopPropagation()}>
        <h3>Gradient Maker</h3>

        <div className="gmPreview" style={{ background: gradCss(sortedStops) }} />

        <div className="gmBarWrap">
          <div className="gmBar" ref={barRef} style={{ background: gradCss(sortedStops, 90) }}
            onDoubleClick={addStop} title="Double-click to add a stop; drag a marker to move it">
            {ordered.map(({ s, i }) => (
              <button key={i} className={"gmStop" + (i === sel ? " on" : "")}
                style={{ left: `${s[1] * 100}%`, background: s[0] }}
                onPointerDown={dragStop(i)} title={`${Math.round(s[1] * 100)}%`} />
            ))}
          </div>
        </div>

        <div className="gmRow">
          <label>Colour
            <input type="color" value={current[0]}
              onChange={(e) => setStop(sel, { c: e.target.value })} />
          </label>
          <label>Position
            <input type="range" min={0} max={100} value={Math.round(current[1] * 100)}
              onChange={(e) => setStop(sel, { p: +e.target.value / 100 })} />
          </label>
          <span className="gmPct">{Math.round(current[1] * 100)}%</span>
          <button onClick={removeStop} disabled={stops.length <= 2}
            title={stops.length <= 2 ? "A gradient needs at least two stops" : "Remove this stop"}>Remove stop</button>
        </div>

        <div className="gmRow">
          <input className="gmName" value={name} placeholder="Name it to save…"
            onChange={(e) => setName(e.target.value)} />
          <button onClick={save}>Save to library</button>
        </div>

        {saved.length > 0 && (
          <>
            <div className="fillPopHead">Your gradients</div>
            <div className="palGrid grads">
              {saved.map((g) => (
                <span key={g.name} className="gmSaved">
                  <button title={g.name} style={{ background: gradCss(g.stops) }}
                    onClick={() => setStops(g.stops.map((s) => [...s] as GradStop))} />
                  <i title="Delete" onClick={() => {
                    const list = saved.filter((x) => x.name !== g.name);
                    saveCustomGrads(list); setSaved(list); onSaved?.();
                  }}>✕</i>
                </span>
              ))}
            </div>
          </>
        )}

        <div className="modalBtns">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => { onApply(sortedStops); onClose(); }}>Apply</button>
        </div>
      </div>
    </div>
  );
}
