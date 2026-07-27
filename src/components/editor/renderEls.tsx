/* ---------------- render helpers ---------------- */
/* Element + selection-overlay rendering. Plain exported functions taking
   the EditorCtx bag — NOT components (element identity is unchanged, so
   contentEditable text keeps focus while editing). */
import React, { CSSProperties } from "react";
import {
  El, FILTERS, aabbOverlap, applyCrossbarI, resolveBalloon, rotVec,
} from "@/lib/model";
import { arcTextLayout, balloonGeom } from "@/lib/geometry";
import { fillCss } from "@/lib/fills";
import { displayText, measureCharWidths, renderRuns, textCss, textOverflows } from "./textHelpers";
import { BalloonShape, MergeBaseInfo } from "./BalloonShape";
import { EditorCtx } from "./ctx";
import { WarpedText } from "./WarpedText";
import { FLAT, Warp, isWarped } from "@/lib/warp";
import { onLetteringInput } from "./ops";


export function renderEl(ed: EditorCtx, el: El) {
  const { editingId, select, startDrag, setStatus, setEditingId, panelImageTarget, filePanelImageRef, setCtxMenu, assetsRef, page, zoom, finishEditing } = ed;
  const tf = [
    el.rot ? `rotate(${el.rot}deg)` : "",
    el.flipH ? "scaleX(-1)" : "",
    el.flipV ? "scaleY(-1)" : "",
  ].filter(Boolean).join(" ");
  const style: CSSProperties = {
    left: el.x, top: el.y, width: el.w, height: el.h,
    transform: tf || undefined,
    opacity: el.opacity ?? 1,
  };
  const common = {
    key: el.id,
    "data-id": el.id,
    onPointerDown: (e: React.PointerEvent) => {
      if (editingId === el.id) return;
      select(el.id);
      if (!el.locked) startDrag(e, el, "move");
      else e.preventDefault();
    },
    onDoubleClick: () => {
      if (el.locked) { setStatus("This item is locked — right-click it to unlock."); return; }
      if (el.type === "balloon" || el.type === "text") { select(el.id); setEditingId(el.id); }
      else if (el.type === "panel" || el.type === "image") { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      select(el.id);
      setCtxMenu({ x: e.clientX, y: e.clientY, id: el.id });
    },
  };

  if (el.type === "panel" || el.type === "image") {
    const src = el.img ? assetsRef.current[el.img] : null;
    const st: CSSProperties = {
      ...style,
      ...(el.type === "panel" ? fillCss(el.fill) : {}),
      border: el.borderW > 0 ? `${el.borderW}px solid ${el.borderC}` : "none",
      overflow: "hidden",
      boxShadow: el.shadow ? "8px 8px 12px #00000059" : undefined,
    };
    return (
      <div {...common} className={"el " + el.type} style={st}>
        {src && (
          <img src={src} className="cover" draggable={false} alt=""
            style={{ filter: FILTERS[el.filter]?.css || undefined }} />
        )}
      </div>
    );
  }

  if (el.type === "balloon") {
    const { el: bEl, base } = resolveBalloon(page!, el);
    let mergeBase: MergeBaseInfo | null = null;
    if (base) {
      const bg = balloonGeom(resolveBalloon(page!, base).el);
      const [rx, ry] = rotVec(
        base.x + base.w / 2 - (el.x + el.w / 2),
        base.y + base.h / 2 - (el.y + el.h / 2), -el.rot);
      mergeBase = {
        d: bg.d,
        color: base.fill.a,
        tf: `translate(${el.w / 2 + rx} ${el.h / 2 + ry}) rotate(${base.rot - el.rot}) translate(${-base.w / 2} ${-base.h / 2})`,
        /* apart: partner redraws with its outline so the band tucks under;
           overlapping: fills union with no divider */
        ...(aabbOverlap(el, base) ? {} : { stroke: base.stroke, strokeW: base.strokeW }),
      };
    }
    const g = balloonGeom(bEl);
    const [tx, ty, tw, th] = g.textRect;
    const editing = editingId === el.id;
    return (
      <div {...common} className="el balloon" style={style}>
        <BalloonShape el={bEl} mergeBase={mergeBase} imgSrc={el.img ? assetsRef.current[el.img] : null} />
        <div
          key={editing ? "edit" : "static"}
          className="txt"
          style={{ ...textCss(el.ts), left: tx, top: ty, width: tw, height: th }}
          contentEditable={editing}
          suppressContentEditableWarning
          spellCheck={editing}
          onBlur={() => editing && finishEditing()}
          onInput={editing ? (e) => onLetteringInput(ed, el.id, e.currentTarget) : undefined}
        >{editing ? null : el.runs ? renderRuns(el.runs, el.ts) : displayText(el.text, el.ts, false)}</div>
        {!editing && textOverflows(el.ts, el.text, tw, th) && (
          /* chrome, not artwork: counter-scale so it stays legible at any zoom */
          <div className="ovfBadge" style={{ transform: `translateX(-50%) scale(${1 / zoom})` }}
            title="More text than this balloon can hold — resize it or shorten the line">+</div>
        )}
      </div>
    );
  }

  /* text / SFX */
  const editing = editingId === el.id;
  if (el.type === "text" && !editing && isWarped(el.ts.env as Warp)) {
    return (
      <div {...common} className="el text" style={style}>
        <WarpedText el={el} env={el.ts.env as Warp} zoom={zoom} />
      </div>
    );
  }
  if (el.warp && !editing && el.text) {
    let raw = (el.ts.caps ? el.text.toUpperCase() : el.text).replace(/\s*\n\s*/g, " ");
    if (el.ts.crossbarI) raw = applyCrossbarI(raw);
    const chars = raw.match(/\P{M}\p{M}*/gu) || [];
    const widths = measureCharWidths(el.ts, chars);
    const layout = arcTextLayout(widths, el.warp);
    const cx0 = el.w / 2, cy0 = el.h / 2;
    const gcss = textCss(el.ts);
    return (
      <div {...common} className="el text" style={style}>
        <div className="txt warp" style={{ position: "absolute", left: 0, top: 0, width: el.w, height: el.h }}>
          {chars.map((ch, i) => ch === " " ? null : (
            <span key={i} style={{
              ...gcss, position: "absolute",
              left: cx0 + layout[i].x, top: cy0 + layout[i].y,
              transform: `translate(-50%, -50%) rotate(${layout[i].rot}rad)`,
              whiteSpace: "pre", lineHeight: 1,
            }}>{ch}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div {...common} className="el text" style={style}>
      <div
        key={editing ? "edit" : "static"}
        className="txt"
        style={{ ...textCss(el.ts), left: 0, top: 0, width: el.w, height: el.h }}
        contentEditable={editing}
        suppressContentEditableWarning
        spellCheck={editing}
        onBlur={() => editing && finishEditing()}
        onInput={editing ? (e) => onLetteringInput(ed, el.id, e.currentTarget) : undefined}
      >{editing ? null : el.runs ? renderRuns(el.runs, el.ts) : displayText(el.text, el.ts, false)}</div>
    </div>
  );
}

export function renderOverlay(ed: EditorCtx) {
  const { selEl, page, zoom, editingId, startDrag, warping, setWarping } = ed;
  if (!selEl || !page) return null;
  const el = selEl.type === "balloon" ? resolveBalloon(page, selEl).el : selEl;
  const z = zoom;
  if (el.locked) {
    return (
      <div className="overlay" style={{
        left: el.x * z, top: el.y * z, width: el.w * z, height: el.h * z,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
      }}>
        <div className="box" style={{ borderStyle: "dashed" }} />
        <div className="lockBadge" title="Locked — unlock in the Inspector">🔒</div>
      </div>
    );
  }
  const handles: [string, number, number][] = [
    ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5],
    ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5],
  ];
  return (
    <div
      className={"overlay" + (editingId === el.id ? " editing" : "")}
      style={{
        left: el.x * z, top: el.y * z, width: el.w * z, height: el.h * z,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
      }}
    >
      <div className="box" />
      {warping === el.id && el.type === "text" ? (
        /* envelope mode: corners pin the patch, edge midpoints bow their side */
        (el.ts.env as Warp | undefined ?? FLAT).map((p, i) => (
          <div key={i} className="handle warpDot"
            title={i < 4 ? "Drag to pin this corner" : "Drag to bow this edge"}
            style={{ left: `calc(${p[0] * 100}% - 5px)`, top: `calc(${p[1] * 100}% - 5px)` }}
            onPointerDown={(e) => startDrag(e, el, "envelope", String(i))}
            onDoubleClick={(e) => { e.stopPropagation(); setWarping(null); }} />
        ))
      ) : handles.map(([k, fx, fy]) => (
        <div key={k} className={`handle h-${k}`}
          title={el.type === "text" ? "Drag to resize · double-click to warp" : "Drag to resize"}
          style={{ left: `calc(${fx * 100}% - 6px)`, top: `calc(${fy * 100}% - 6px)` }}
          onPointerDown={(e) => startDrag(e, el, "resize", k)}
          onDoubleClick={(e) => {
            if (el.type !== "text") return;
            e.stopPropagation();
            setWarping(el.id);
          }} />
      ))}
      <div className="handle rot" title="Rotate (Shift snaps to 15°)"
        style={{ left: "calc(50% - 6px)", top: -28 }}
        onPointerDown={(e) => startDrag(e, el, "rotate")} />
      {el.type === "balloon" && el.tail && (
        <div className="handle tail" title="Drag to aim the tail tip"
          style={{ left: (el.w / 2 + el.tail.dx) * z - 7, top: (el.h / 2 + el.tail.dy) * z - 7 }}
          onPointerDown={(e) => startDrag(e, el, "tail")} />
      )}
      {el.type === "balloon" && el.tail &&
        (["speech", "whisper", "double", "thought"].includes(el.kind) || el.attachTo) && (() => {
        const t = Math.atan2(el.tail.dy, el.tail.dx);
        const ex = el.w / 2 + (el.w / 2) * Math.cos(t);
        const ey = el.h / 2 + (el.h / 2) * Math.sin(t);
        const bx = el.tail.bx ?? (ex + el.w / 2 + el.tail.dx) / 2 - el.w / 2;
        const by = el.tail.by ?? (ey + el.h / 2 + el.tail.dy) / 2 - el.h / 2;
        return (
          <div className="handle tailBow" title="Drag to bend the tail"
            style={{ left: (el.w / 2 + bx) * z - 6, top: (el.h / 2 + by) * z - 6 }}
            onPointerDown={(e) => startDrag(e, el, "bow")} />
        );
      })()}
      {el.type === "balloon" && el.tail && el.attachTo && (() => {
        /* three-point connector axis: middle bends, satellites tilt */
        const bx = el.tail.bx ?? el.tail.dx / 2, by = el.tail.by ?? el.tail.dy / 2;
        const M = [el.w / 2 + bx, el.h / 2 + by];
        const dl = Math.hypot(el.tail.dx, el.tail.dy) || 1;
        let T = el.tail.tx != null && el.tail.ty != null
          ? [el.tail.tx, el.tail.ty]
          : [el.tail.dx / dl, el.tail.dy / dl];
        const tl = Math.hypot(T[0], T[1]) || 1;
        T = [T[0] / tl, T[1] / tl];
        const L = 55 / z;
        const h1 = [M[0] + T[0] * L, M[1] + T[1] * L];
        const h2 = [M[0] - T[0] * L, M[1] - T[1] * L];
        return (
          <>
            <svg style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
              <line x1={h1[0] * z} y1={h1[1] * z} x2={h2[0] * z} y2={h2[1] * z} stroke="#777" strokeWidth={1} />
            </svg>
            <div className="handle tiltDot" title="Tilt the connector"
              style={{ left: h1[0] * z - 5, top: h1[1] * z - 5 }}
              onPointerDown={(e) => startDrag(e, el, "tilt", "t1")} />
            <div className="handle tiltDot" title="Tilt the connector"
              style={{ left: h2[0] * z - 5, top: h2[1] * z - 5 }}
              onPointerDown={(e) => startDrag(e, el, "tilt", "t2")} />
          </>
        );
      })()}
    </div>
  );
}
