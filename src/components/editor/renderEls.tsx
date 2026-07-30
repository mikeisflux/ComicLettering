/* ---------------- render helpers ---------------- */
/* Element + selection-overlay rendering. Plain exported functions taking
   the EditorCtx bag — NOT components (element identity is unchanged, so
   contentEditable text keeps focus while editing). */
import React, { CSSProperties } from "react";
import {
  El, FILTERS, aabbOverlap, applyCrossbarI, resolveBalloon, rotVec,
} from "@/lib/model";
import { arcTextLayout, balloonGeom, connectorMid } from "@/lib/geometry";
import { fillCss } from "@/lib/fills";
import { displayText, measureCharWidths, renderRuns, textCss, textOverflows } from "./textHelpers";
import { BalloonShape, MergeBaseInfo } from "./BalloonShape";
import { EditorCtx } from "./ctx";
import { WarpedText } from "./WarpedText";
import { FLAT, Warp, isWarped, warpBounds } from "@/lib/warp";
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
      /* A right-click fires pointerdown first. Left alone it collapsed the
         selection to one element before the context menu could open, so
         "select all, right-click, lock" locked exactly one thing — and it
         started a drag with the wrong button on the way. */
      if (e.button === 2) {
        if (!ed.selIds.includes(el.id)) select(el.id);
        return;
      }
      /* ctrl/cmd (or shift) adds to the selection instead of replacing it */
      const add = e.ctrlKey || e.metaKey || e.shiftKey;
      select(el.id, add);
      /* an additive click is picking, not dragging — starting a drag here
         would nudge the set every time you add one more to it */
      if (!el.locked && !add) startDrag(e, el, "move");
      else e.preventDefault();
    },
    onDoubleClick: () => {
      if (el.locked) { setStatus("This item is locked — right-click it to unlock."); return; }
      if (el.type === "balloon" || el.type === "text") { select(el.id); setEditingId(el.id); }
      else if (el.type === "panel" || el.type === "image") { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      /* right-clicking inside an existing multi-selection keeps it, so the
         menu acts on everything you picked rather than throwing it away */
      if (!ed.selIds.includes(el.id)) select(el.id);
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
        /* the partner's plain BODY (no tail) — the wedge = d minus bodyD, used
           to redraw the partner's speaker tail ON TOP of the connector band */
        bodyD: balloonGeom({ ...base, tail: null, band: false, attachTo: null }).d,
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
    /* The warp draws outside the box the text was laid out in, so the element
       itself grows to cover what it draws. Otherwise the letters are visible
       but not clickable — the hit area stayed on the old rect. */
    const env = el.ts.env as Warp;
    const b = warpBounds(env);
    const ox = Math.min(0, b.x0), oy = Math.min(0, b.y0);
    const wStyle: CSSProperties = {
      ...style,
      left: el.x + ox * el.w,
      top: el.y + oy * el.h,
      width: Math.max(el.w, (Math.max(1, b.x1) - ox) * el.w),
      height: Math.max(el.h, (Math.max(1, b.y1) - oy) * el.h),
    };
    return (
      <div {...common} className="el text warped" style={wStyle}>
        <WarpedText el={el} env={env} zoom={zoom} />
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
  const { selEl, selEls, page, zoom, editingId, startDrag, warping, setWarping, tiltConn, setTiltConn } = ed;
  if (!selEl || !page) return null;
  /* With several picked, the extras get a plain outline and the primary keeps
     the handles — you can only resize or rotate one thing at a time, but you
     need to see everything that a move, lock or delete will reach. */
  if (selEls.length > 1) {
    return (
      <>
        {selEls.map((e) => {
          const b = e.type === "balloon" ? resolveBalloon(page, e).el : e;
          return (
            <div key={e.id} className={"overlay multi" + (e.id === selEl.id ? " lead" : "")}
              style={{
                left: b.x * zoom, top: b.y * zoom, width: b.w * zoom, height: b.h * zoom,
                transform: b.rot ? `rotate(${b.rot}deg)` : undefined,
              }}>
              <div className="box" />
              {e.locked && <div className="lockBadge" title="Locked">🔒</div>}
            </div>
          );
        })}
      </>
    );
  }
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
  /* A warp moves the letters outside the box they were laid out in, so the
     selection rect follows where the letters ended up rather than the layout
     box they came from. Positions inside the overlay are remapped into it. */
  const envW = el.type === "text" && isWarped(el.ts.env as Warp) ? (el.ts.env as Warp) : null;
  const eb = envW ? warpBounds(envW) : null;
  const bx = eb ? el.x + eb.x0 * el.w : el.x;
  const by = eb ? el.y + eb.y0 * el.h : el.y;
  const bw = eb ? Math.max(1, (eb.x1 - eb.x0) * el.w) : el.w;
  const bh = eb ? Math.max(1, (eb.y1 - eb.y0) * el.h) : el.h;
  /* element-box units → a fraction of the selection rect */
  const fx = (u: number) => eb ? (u - eb.x0) / (eb.x1 - eb.x0) : u;
  const fy = (v: number) => eb ? (v - eb.y0) / (eb.y1 - eb.y0) : v;
  return (
    <div
      className={"overlay" + (editingId === el.id ? " editing" : "")}
      style={{
        left: bx * z, top: by * z, width: bw * z, height: bh * z,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
      }}
    >
      <div className="box" />
      {warping === el.id && el.type === "text" ? (
        /* envelope mode: corners pin the patch, edge midpoints bow their side */
        (el.ts.env as Warp | undefined ?? FLAT).map((p, i) => (
          <div key={i} className="handle warpDot"
            title={i < 4 ? "Drag to pin this corner" : "Drag to bow this edge"}
            style={{ left: `calc(${fx(p[0]) * 100}% - 5px)`, top: `calc(${fy(p[1]) * 100}% - 5px)` }}
            onPointerDown={(e) => startDrag(e, el, "envelope", String(i))}
            onDoubleClick={(e) => { e.stopPropagation(); setWarping(null); }} />
        ))
      ) : handles.map(([k, hx, hy]) => (
        <div key={k} className={`handle h-${k}`}
          title={el.type === "text" ? "Drag to resize · double-click to warp" : "Drag to resize"}
          style={{ left: `calc(${fx(hx) * 100}% - 6px)`, top: `calc(${fy(hy) * 100}% - 6px)` }}
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
      {/* The tail TIP handle only makes sense on a free balloon aiming its
          speaker tail. On a JOINED bubble the connector runs between the two
          balloons and re-aims itself as you move either one — an orange tip
          there does nothing but detach the pair when grabbed, so hide it.
          Reposition a joined bubble by dragging its body; bend/tilt the band
          with the handles below. */}
      {el.type === "balloon" && el.tail && !el.attachTo && (
        <div className="handle tail" title="Drag to aim the tail tip"
          style={{ left: (el.w / 2 + el.tail.dx) * z - 7, top: (el.h / 2 + el.tail.dy) * z - 7 }}
          onPointerDown={(e) => startDrag(e, el, "tail")} />
      )}
      {/* single-tail bend handle — NOT on joined bubbles, which get the
          dedicated three-point connector axis below instead */}
      {el.type === "balloon" && el.tail && !el.attachTo &&
        ["speech", "whisper", "double", "thought"].includes(el.kind) && (() => {
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
        /* Connector controls on a joined bubble — NEITHER moves the bubble:
           - the MIDDLE dot bends the connecting band into a smooth flowing
             CURVE through wherever you drag it, so you can sweep it into a
             graceful arc around the main bubble (like hand-inked lettering).
             The bubbles stay put and stay joined.
           - double-clicking the middle dot reveals the tilt axis: two
             satellite dots that lean the curve's angle. */
        /* handle sits at the TRUE middle of the visible band (child edge →
           partner edge), not center→tip which biases toward this bubble */
        const M = connectorMid(el) ?? [el.w / 2 + el.tail.dx / 2, el.h / 2 + el.tail.dy / 2];
        const dl = Math.hypot(el.tail.dx, el.tail.dy) || 1;
        let T = el.tail.tx != null && el.tail.ty != null
          ? [el.tail.tx, el.tail.ty]
          : [el.tail.dx / dl, el.tail.dy / dl];
        const tl = Math.hypot(T[0], T[1]) || 1;
        T = [T[0] / tl, T[1] / tl];
        const L = 55 / z;
        const h1 = [M[0] + T[0] * L, M[1] + T[1] * L];
        const h2 = [M[0] - T[0] * L, M[1] - T[1] * L];
        const showTilt = tiltConn === el.id;
        return (
          <>
            {showTilt && (
              <svg style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
                <line x1={h1[0] * z} y1={h1[1] * z} x2={h2[0] * z} y2={h2[1] * z} stroke="#777" strokeWidth={1} />
              </svg>
            )}
            {showTilt && (
              <div className="handle tiltDot" title="Tilt the connector"
                style={{ left: h1[0] * z - 5, top: h1[1] * z - 5 }}
                onPointerDown={(e) => startDrag(e, el, "tilt", "t1")} />
            )}
            {showTilt && (
              <div className="handle tiltDot" title="Tilt the connector"
                style={{ left: h2[0] * z - 5, top: h2[1] * z - 5 }}
                onPointerDown={(e) => startDrag(e, el, "tilt", "t2")} />
            )}
            <div className="handle connMove"
              title="Drag to curve the connecting tail · double-click to tilt"
              style={{ left: M[0] * z - 7, top: M[1] * z - 7 }}
              onPointerDown={(e) => startDrag(e, el, "bow")}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setTiltConn(showTilt ? null : el.id);
              }} />
          </>
        );
      })()}
    </div>
  );
}
