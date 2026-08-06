/* ---------------- render helpers ---------------- */
/* Element + selection-overlay rendering. Plain exported functions taking
   the EditorCtx bag — NOT components (element identity is unchanged, so
   contentEditable text keeps focus while editing). */
import React, { CSSProperties } from "react";
import {
  El, FILTERS, JoinLink, PanelEl, TextEl, aabbOverlap, applyCrossbarI, joinGroupRect, joinLinks, panelPathD, resolveBalloon, rotVec,
} from "@/lib/model";
import { arcTextLayout, balloonGeom, connectorMid } from "@/lib/geometry";
import { fillCss } from "@/lib/fills";
import { displayText, measureBlock, measureCharWidths, renderRuns, textCss, textOverflows } from "./textHelpers";
import { BalloonShape, JoinBandShape, MergeBaseInfo } from "./BalloonShape";
import { EditorCtx } from "./ctx";
import { WarpedText } from "./WarpedText";
import { FLAT, Warp, isWarped, warpBounds, warpPoint } from "@/lib/warp";
import {
  TrimRect, balloonCrossesSpine, balloonCrossesTrim, elCrossesSpine, spreadNeighbor,
  stampCrossesTrim, textCrossesTrim,
} from "@/lib/exportPng";
import { pageBleed } from "@/lib/model";
import { onLetteringInput, refitLetteringEl } from "./ops";
import { dragInProgress, isDoubleTap } from "./penInput";
import { textInkFractions, warpInkBounds } from "./textInk";

/* ---------- autoclipping self-replication ----------
   Lettering cut off at the facing page's spine-side bleed line REAPPEARS
   here, starting at THIS page's bleed line: each crossing item on the
   partner page renders again as a read-only, auto-positioned copy — the
   same element, translated by the trim join, so it can never drift from
   its source. Clipped to this page's trim rect; not selectable (its home
   is the partner page). Mirrors the canvas renderer's partner pass, so
   the live page matches previews, thumbnails and every export. */
export function renderCarriedLettering(ed: EditorCtx) {
  const doc = ed.doc;
  if (!doc) return null;
  const nb = spreadNeighbor(doc, ed.pageIndex);
  if (!nb) return null;
  /* the partner's spine is the side FACING us: partner on our right (dx>0)
     crosses its LEFT bleed line, partner on our left crosses its RIGHT */
  const pSide: 1 | -1 = nb.dx > 0 ? -1 : 1;
  const pb = pageBleed(nb.page);
  const pTrim = pSide === 1 ? nb.page.w - pb : pb;
  const carried = nb.page.els.filter((el) => elCrossesSpine(el, pTrim, pSide));
  if (!carried.length) return null;
  const page = ed.page!;
  const b = pageBleed(page);
  /* our trim rect, in the (translated) partner frame — the copy starts at
     our bleed line and may never show past any of our bleed lines */
  const clip = `polygon(${[
    [b - nb.dx, b], [page.w - b - nb.dx, b],
    [page.w - b - nb.dx, page.h - b], [b - nb.dx, page.h - b],
  ].map(([x, y]) => `${Math.round(x)}px ${Math.round(y)}px`).join(", ")})`;
  /* the copies resolve joins/styles against their OWN page, unclipped at
     the partner trim (the piece we show is exactly what that clip removes) */
  /* the copy's SOURCE page — this ctx's spread partner. The copies carry
     that identity, so pressing one claims the source page automatically
     (claimPage in renderEl) and edits the real element directly. */
  const pn = ed.pageIndex + 1;
  const srcIndex = pn % 2 === 0 ? ed.pageIndex + 1 : ed.pageIndex - 1;
  const edP: EditorCtx = {
    ...ed, page: nb.page, pageIndex: srcIndex,
    bleedClip: null, selIds: [], editingId: null,
  };
  return (
    <div className="carriedLettering" style={{
      position: "absolute", left: nb.dx, top: 0,
      width: nb.page.w, height: nb.page.h,
      pointerEvents: "none", clipPath: clip, zIndex: 1,
      /* own compositor layer: the copy repaints live while its source is
         dragged on the other page — keep that off the main page layer */
      transform: "translateZ(0)", willChange: "transform",
    }}>
      {carried.map((el) => (
        /* lettering shared across two pages is editable from EITHER half:
           this wrapper re-enables pointer events on the copy, and the
           copy's own handlers (with its source-page ctx) do the rest */
        <div key={`carry-${el.id}`} style={{ pointerEvents: "auto" }}>
          {renderEl(edP, el)}
        </div>
      ))}
      {nb.page.els.map((_, i) => (
        <React.Fragment key={`carryband-${i}`}>
          {renderJoinBands(edP, i, (l) =>
            balloonCrossesSpine(l.child, pTrim, pSide) || balloonCrossesSpine(l.base, pTrim, pSide))}
        </React.Fragment>
      ))}
    </div>
  );
}

/* The bleed line is a HARD border for word balloons, text boxes, lettering
   and stamps — in the live editor page too, whatever the view. Each of
   those item kinds runs its OWN crossing test (balloonCrossesTrim /
   textCrossesTrim / stampCrossesTrim) in its own render branch below; page
   art and panels are exempt and keep filling the bleed. The clip is the
   page's trim rect mapped into the element's local box, so it survives
   rotation and flips (clip-path applies before the wrapper's transform). */
function bleedClipPath(
  el: { x: number; y: number; w: number; h: number; rot: number; flipH?: boolean; flipV?: boolean },
  r: TrimRect,
): string {
  const th = ((el.rot || 0) * Math.PI) / 180;
  const fx = el.flipH ? -1 : 1, fy = el.flipV ? -1 : 1;
  const pcx = el.x + el.w / 2, pcy = el.y + el.h / 2;
  const inv = (px: number, py: number): [number, number] => {
    const dx = px - pcx, dy = py - pcy;
    const rx = dx * Math.cos(th) + dy * Math.sin(th);
    const ry = -dx * Math.sin(th) + dy * Math.cos(th);
    return [el.w / 2 + rx * fx, el.h / 2 + ry * fy];
  };
  const c = [inv(r.x0, r.y0), inv(r.x1, r.y0), inv(r.x1, r.y1), inv(r.x0, r.y1)];
  return `polygon(${c.map(([x, y]) => `${Math.round(x)}px ${Math.round(y)}px`).join(", ")})`;
}


/* Connector bands are their own render pass: one overlay per join link,
   inserted right after WHICHEVER partner renders later (joinLinks.afterIndex),
   so the band's fill covers both outline crossings no matter which bubble is
   on top — and no link ever repaints another link's junction. */
export function renderJoinBands(
  ed: EditorCtx, index: number,
  only?: (l: JoinLink) => boolean,
) {
  const page = ed.page!;
  return joinLinks(page)
    .filter((l) => l.afterIndex === index && (!only || only(l)))
    .map((l) => {
      const { el: bEl, base } = resolveBalloon(page, l.child);
      if (!base || !bEl.band) return null;   // melted or detached — no band
      const bg = balloonGeom(resolveBalloon(page, base).el);
      const [rx, ry] = rotVec(
        base.x + base.w / 2 - (l.child.x + l.child.w / 2),
        base.y + base.h / 2 - (l.child.y + l.child.h / 2), -l.child.rot);
      const mergeBase: MergeBaseInfo = {
        d: bg.d,
        bodyD: balloonGeom({ ...base, tail: null, band: false, attachTo: null }).d,
        color: base.fill.a,
        tf: `translate(${l.child.w / 2 + rx} ${l.child.h / 2 + ry}) rotate(${base.rot - l.child.rot}) translate(${-base.w / 2} ${-base.h / 2})`,
        stroke: base.stroke, strokeW: base.strokeW,
      };
      const jg = joinGroupRect(page, l.child);
      const joinRect = jg ? { x: jg.x - l.child.x, y: jg.y - l.child.y, w: jg.w, h: jg.h } : null;
      const tf = [
        l.child.rot ? `rotate(${l.child.rot}deg)` : "",
        l.child.flipH ? "scaleX(-1)" : "",
        l.child.flipV ? "scaleY(-1)" : "",
      ].filter(Boolean).join(" ");
      return (
        <div key={`band-${l.child.id}`} className="bandOverlay"
          style={{
            position: "absolute", left: l.child.x, top: l.child.y,
            width: l.child.w, height: l.child.h,
            transform: tf || undefined, opacity: l.child.opacity ?? 1,
            pointerEvents: "none",
            clipPath: ed.bleedClip &&
              (balloonCrossesTrim(l.child, ed.bleedClip) || balloonCrossesTrim(base, ed.bleedClip))
              ? bleedClipPath(l.child, ed.bleedClip) : undefined,
          }}>
          <JoinBandShape el={bEl} mergeBase={mergeBase} joinRect={joinRect} />
        </div>
      );
    });
}

/* On the spread canvas both pages are live at once: pressing anything
   claims ITS page as the ops target — synchronously (the ref first), so the
   very same pointerdown's drag/selection machinery already sees the right
   page. Invisible to the user: nothing changes on screen. */
export function claimPage(ed: EditorCtx): boolean {
  if (ed.pageIndexRef.current !== ed.pageIndex) {
    (ed.pageIndexRef as React.RefObject<number>).current = ed.pageIndex;
    ed.setPageIndex(ed.pageIndex);
    return true;
  }
  return false;
}

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
  /* the bleed line is a hard border — each item kind runs its OWN test:
     word balloons (tail included), text boxes/lettering (warp included),
     stamps. Page art and panels are exempt on purpose. */
  const bc = ed.bleedClip;
  if (bc) {
    if (el.type === "balloon" && balloonCrossesTrim(el, bc)) style.clipPath = bleedClipPath(el, bc);
    else if (el.type === "text" && textCrossesTrim(el, bc)) style.clipPath = bleedClipPath(el, bc);
    else if (el.type === "image" && stampCrossesTrim(el, bc)) style.clipPath = bleedClipPath(el, bc);
  }
  const common = {
    key: el.id,
    "data-id": el.id,
    onPointerDown: (e: React.PointerEvent) => {
      if (editingId === el.id) return;
      /* a second finger landing mid-drag must not re-select, switch the
         ops-target page, or start a competing drag */
      if (dragInProgress()) return;
      const switched = claimPage(ed);
      /* A right-click fires pointerdown first. Left alone it collapsed the
         selection to one element before the context menu could open, so
         "select all, right-click, lock" locked exactly one thing — and it
         started a drag with the wrong button on the way. */
      if (e.button === 2) {
        if (!ed.selIds.includes(el.id)) select(el.id);
        return;
      }
      /* ctrl/cmd (or shift) adds to the selection instead of replacing it —
         but never ACROSS pages: the previous ids live on the other page,
         and ops on a mixed set would silently skip them. Claiming a new
         page makes this press a fresh selection. */
      const add = (e.ctrlKey || e.metaKey || e.shiftKey) && !switched;
      /* grabbing a member of a MULTI-selection keeps the whole set — the
         drag moves the convoy together. Collapsing here made a group drag
         silently move only the grabbed one; the collapse now happens on
         pointer-up when nothing moved (see useStartDrag's onUp). */
      const inGroup = !add && !el.locked && ed.selIds.length > 1 && ed.selIds.includes(el.id);
      if (!inGroup) select(el.id, add);
      /* touch double-tap = double-click (browsers synthesize dblclick from
         taps too unevenly to rely on): edit the words */
      if (!el.locked && isDoubleTap("el:" + el.id, e) &&
        (el.type === "balloon" || el.type === "text")) {
        e.preventDefault();   // suppress compat mouse events re-firing on the new UI
        setEditingId(el.id);
        return;
      }
      /* an additive click is picking, not dragging — starting a drag here
         would nudge the set every time you add one more to it */
      if (!el.locked && !add) startDrag(e, el, "move");
      else e.preventDefault();
    },
    onDoubleClick: () => {
      if (el.locked) { setStatus("This item is locked — right-click it to unlock."); return; }
      claimPage(ed);
      if (el.type === "balloon" || el.type === "text") { select(el.id); setEditingId(el.id); }
      else if (el.type === "panel" || el.type === "image") { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      claimPage(ed);
      /* right-clicking inside an existing multi-selection keeps it, so the
         menu acts on everything you picked rather than throwing it away */
      if (!ed.selIds.includes(el.id)) select(el.id);
      setCtxMenu({ x: e.clientX, y: e.clientY, id: el.id });
    },
  };

  if (el.type === "panel" || el.type === "image") {
    const src = el.img ? assetsRef.current[el.img] : null;
    /* pen-drawn ("Draw Your Own") panel: fill and artwork clip to the drawn
       outline and the border strokes along it. The shadow filter must sit on
       the OUTER div — clip-path would clip away its own drop-shadow. */
    const penD = el.type === "panel" ? panelPathD(el) : null;
    const zIndex =
      /* Tuck cutouts are foreground ART: with a facing partner they sit
         above the carried lettering too (zIndex 1), exactly like the
         canvas renderer's final cutout pass — a cross-spine tuck reads as
         the art passing in front of the double-page SFX */
      el.type === "image" && el.cut && ed.doc && spreadNeighbor(ed.doc, ed.pageIndex)
        ? 2 : undefined;
    if (penD) {
      return (
        <div {...common} className="el panel" style={{
          ...style, border: "none", overflow: "visible", zIndex,
          filter: el.shadow ? "drop-shadow(8px 8px 12px #00000059)" : undefined,
        }}>
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", clipPath: `path("${penD}")`, ...fillCss((el as PanelEl).fill) }}>
            {src && (
              <img src={src} className="cover" draggable={false} alt=""
                style={{ filter: FILTERS[el.filter]?.css || undefined }} />
            )}
          </div>
          {el.borderW > 0 && (
            <svg width={el.w} height={el.h} viewBox={`0 0 ${el.w} ${el.h}`}
              style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
              <defs><clipPath id={`penclip-${el.id}`}><path d={penD} /></clipPath></defs>
              {/* doubled stroke clipped to the inside = the same inner border
                  a rect panel's CSS border gives */}
              <path d={penD} fill="none" stroke={el.borderC} strokeWidth={el.borderW * 2}
                clipPath={`url(#penclip-${el.id})`} />
            </svg>
          )}
        </div>
      );
    }
    const st: CSSProperties = {
      ...style,
      ...(el.type === "panel" ? fillCss(el.fill) : {}),
      border: el.borderW > 0 ? `${el.borderW}px solid ${el.borderC}` : "none",
      overflow: "hidden",
      boxShadow: el.shadow ? "8px 8px 12px #00000059" : undefined,
      zIndex,
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
    /* joined group: fills span the whole group so styles flow across the join */
    const jg = joinGroupRect(page!, el);
    const joinRect = jg ? { x: jg.x - el.x, y: jg.y - el.y, w: jg.w, h: jg.h } : null;
    return (
      <div {...common} className="el balloon" style={style}>
        <BalloonShape el={bEl} mergeBase={mergeBase} imgSrc={el.img ? assetsRef.current[el.img] : null} joinRect={joinRect} />
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
    /* the bleed clip was computed for the ORIGINAL element box — this
       wrapper sits at the grown warp bounds, so reusing that polygon cuts
       the ink in the wrong place and the lettering appears to MOVE the
       moment a warp is applied. Recompute it for the wrapper's real
       geometry so the item stays put and only the pulled edge bends. */
    if (style.clipPath && bc) {
      wStyle.clipPath = bleedClipPath({
        x: wStyle.left as number, y: wStyle.top as number,
        w: wStyle.width as number, h: wStyle.height as number,
        rot: el.rot, flipH: el.flipH, flipV: el.flipV,
      }, bc);
    }
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

/* ONE way into warp mode (touch double-tap + mouse double-click both land
   here): envelope coords are fractions of the LAYOUT box, so an oversized
   box would open a fresh warp with its dots far from the letters — refit
   the box snug to the ink first (a warped element's box is already the
   warp's coordinate space and is left alone). */
function enterWarp(ed: EditorCtx, el: El) {
  if (el.type !== "text") return;
  if (refitLetteringEl(el)) ed.commit();
  ed.setWarping(el.id);
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
     box they came from. Plain lettering gets the same treatment via the
     measured ink, so the manipulation box hugs the letters. Positions inside
     the overlay are remapped into it. Skipped while editing (the caret needs
     the true box) and while warping (envelope dots live in box units). */
  const editingThis = editingId === el.id;
  const warpingThis = warping === el.id && el.type === "text";
  const envW = el.type === "text" && !editingThis && !warpingThis && isWarped(el.ts.env as Warp) ? (el.ts.env as Warp) : null;
  let eb: { x0: number; y0: number; x1: number; y1: number } | null = null;
  if (warpingThis) {
    /* warp mode: the overlay box is the bounding box of the DOTS themselves,
       so box and handles always agree — previously the box hugged the ink
       while the dots sat at layout-box corners, two different rects */
    const env = (el.ts.env as Warp | undefined) ?? FLAT;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [u, v] of env) {
      if (u < x0) x0 = u;
      if (u > x1) x1 = u;
      if (v < y0) y0 = v;
      if (v > y1) y1 = v;
    }
    if (x1 - x0 > 0.01 && y1 - y0 > 0.01 && (x0 !== 0 || y0 !== 0 || x1 !== 1 || y1 !== 1)) {
      eb = { x0, y0, x1, y1 };
    }
  } else if (envW) {
    eb = warpInkBounds(el as TextEl, envW);
  } else if (el.type === "text" && !editingThis) {
    eb = textInkFractions(el as TextEl);
  }
  const bx = eb ? el.x + eb.x0 * el.w : el.x;
  const by = eb ? el.y + eb.y0 * el.h : el.y;
  const bw = eb ? Math.max(1, (eb.x1 - eb.x0) * el.w) : el.w;
  const bh = eb ? Math.max(1, (eb.y1 - eb.y0) * el.h) : el.h;
  /* Autoclipping self-replication for the TOOLS: when the selected
     lettering crosses the spine-side bleed line, the overlay splits with
     it — the box and every handle stop at the bleed line here and continue
     on the facing page over the carried ink, using the same trim-join
     mapping the renderers use. Drags stay correct because every drag mode
     works on pointer DELTAS, not absolute positions. */
  const carry = (() => {
    const d = ed.doc;
    if (!d) return null;
    const pn = ed.pageIndex + 1;
    const fi = pn === 1 ? -1 : pn % 2 === 0 ? ed.pageIndex + 1 : ed.pageIndex - 1;
    if (fi < 0 || fi >= d.pages.length) return null;
    /* only when the partner shares the spread canvas */
    if (!ed.spreadLayout.some((s) => s.idx === fi)) return null;
    const onto = spreadNeighbor(d, fi);      // this page's content → partner coords
    if (!onto) return null;
    const pg = d.pages[ed.pageIndex];
    const b = pageBleed(pg);
    const side: 1 | -1 = pn % 2 === 0 ? 1 : -1;
    const trimX = side === 1 ? pg.w - b : b;
    if (!elCrossesSpine(el, trimX, side)) return null;
    return {
      side, trimX, dx: onto.dx,
      offX: ed.spreadOffX(fi) - ed.spreadOffX(ed.pageIndex), offY: 0,
    };
  })();
  /* A point in this overlay's local frame → where it visually appears.
     The overlay may be ROTATED (CSS transform about the element centre), so
     the crossing test uses the point's true PAGE position, and the carry
     displacement — a page-space translation — is rotated back into the
     overlay's local frame before it is applied. */
  const vis = (px: number, py: number): [number, number] => {
    if (!carry) return [px, py];
    const ecx = el.x + el.w / 2, ecy = el.y + el.h / 2;
    const pageX = el.rot ? ecx + rotVec(px - ecx, py - ecy, el.rot)[0] : px;
    if (!(carry.side === 1 ? pageX > carry.trimX : pageX < carry.trimX)) return [px, py];
    const [tx, ty] = el.rot
      ? rotVec(carry.offX + carry.dx, carry.offY, -el.rot)
      : [carry.offX + carry.dx, carry.offY];
    return [px + tx, py + ty];
  };
  /* the split box stays axis-aligned — only meaningful unrotated */
  const boxSplit = carry && !el.rot && bx < carry.trimX && bx + bw > carry.trimX;
  return (
    <div
      className={"overlay" + (editingId === el.id ? " editing" : "")}
      style={{
        left: bx * z, top: by * z, width: bw * z, height: bh * z,
        transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
        /* the element rotates about ITS box centre — when the overlay is the
           smaller ink rect, rotate it about that same point or the two drift */
        transformOrigin: el.rot
          ? `${(el.x + el.w / 2 - bx) * z}px ${(el.y + el.h / 2 - by) * z}px`
          : undefined,
      }}
    >
      {boxSplit && carry ? (
        /* the box splits like the lettering: it stops at the bleed line
           here and continues on the facing page over the carried ink */
        (() => {
          const t = carry.trimX;
          const cur: [number, number] = carry.side === 1 ? [bx, t] : [t, bx + bw];
          const far: [number, number] = carry.side === 1 ? [t, bx + bw] : [bx, t];
          const farLeft = carry.offX + far[0] + carry.dx;
          return (
            <>
              <div className="box" style={{
                left: (cur[0] - bx) * z, top: 0,
                width: (cur[1] - cur[0]) * z, height: bh * z,
              }} />
              <div className="box" style={{
                left: (farLeft - bx) * z, top: carry.offY * z,
                width: (far[1] - far[0]) * z, height: bh * z,
              }} />
            </>
          );
        })()
      ) : <div className="box" />}
      {warping === el.id && el.type === "text" ? (
        /* envelope mode: corners pin the patch, edge midpoints bow their
           side. Autoclipping self-replication applies to the TOOL too: a
           control point past the spine-side bleed line is shown on the
           carried lettering on the facing page (same trim-join mapping the
           renderers use), so every handle sits on the ink it bends. The
           drag itself is delta-based, so a carried handle edits normally. */
        (el.ts.env as Warp | undefined ?? FLAT).map((p, i) => {
          /* each dot sits at its TRUE envelope position (env coords are
             fractions of the LAYOUT box — the space the drag writes into).
             Remapping dots into their own bounding rect made dragging one
             dot visibly displace the others and outrun the finger (a
             reported tablet bug). The box stays on the letters because
             entering warp mode refits an oversized box to the ink first. */
          const [px, py] = vis(el.x + p[0] * el.w, el.y + p[1] * el.h);
          return (
            <div key={i} className="handle warpDot"
              title={i < 4 ? "Drag to pin this corner" : "Drag to bow this edge"}
              style={{ left: (px - bx) * z - 5, top: (py - by) * z - 5 }}
              onPointerDown={(e) => {
                /* touch double-tap on a dot = leave warp mode */
                if (isDoubleTap("wd:" + el.id, e)) { e.preventDefault(); setWarping(null); return; }
                startDrag(e, el, "envelope", String(i));
              }}
              onDoubleClick={(e) => { e.stopPropagation(); setWarping(null); }} />
          );
        })
      ) : handles.map(([k, hx, hy]) => {
        /* handles sit on the (possibly ink-hugged) selection rect itself —
           remapping them back into layout-box corners flung them far off the
           letters whenever the box was bigger than the ink. Handles past the
           spine-side bleed line follow the carried ink to the facing page
           (resize drags are delta-based, so they keep working there). */
        const [vx, vy] = vis(bx + hx * bw, by + hy * bh);
        return (
          <div key={k} className={`handle h-${k}`}
            title={el.type === "text" ? "Drag to resize · double-click to warp" : "Drag to resize"}
            style={{ left: (vx - bx) * z - 6, top: (vy - by) * z - 6 }}
            onPointerDown={(e) => {
              /* touch double-tap on a lettering handle = enter warp mode */
              /* preventDefault, or the tap's compat dblclick lands on the
                 warp dot that just rendered here and exits warp instantly */
              if (el.type === "text" && isDoubleTap("h:" + el.id, e)) { e.preventDefault(); enterWarp(ed, el); return; }
              startDrag(e, el, "resize", k);
            }}
            onDoubleClick={(e) => {
              if (el.type !== "text") return;
              e.stopPropagation();
              enterWarp(ed, el);
            }} />
        );
      })}
      {(() => {
        const [rx, ry] = vis(bx + bw / 2, by);
        return (
          <div className="handle rot" title="Rotate (Shift snaps to 15°)"
            style={{ left: (rx - bx) * z - 6, top: (ry - by) * z - 28 }}
            onPointerDown={(e) => startDrag(e, el, "rotate")} />
        );
      })()}
      {/* The tail TIP handle only makes sense on a free balloon aiming its
          speaker tail. On a JOINED bubble the connector runs between the two
          balloons and re-aims itself as you move either one — an orange tip
          there does nothing but detach the pair when grabbed, so hide it.
          Reposition a joined bubble by dragging its body; bend/tilt the band
          with the handles below. */}
      {el.type === "balloon" && el.tail && !el.attachTo && (() => {
        /* tail handles ride the carried mapping too — a tail aimed past the
           spine-side bleed line shows its controls on the facing page */
        const [vx, vy] = vis(el.x + el.w / 2 + el.tail.dx, el.y + el.h / 2 + el.tail.dy);
        return (
          <div className="handle tail" title="Drag to aim the tail tip · drop it inside another bubble to join them"
            style={{ left: (vx - el.x) * z - 7, top: (vy - el.y) * z - 7 }}
            onPointerDown={(e) => startDrag(e, el, "tail")} />
        );
      })()}
      {/* single-tail bend handle — NOT on joined bubbles, which get the
          dedicated three-point connector axis below instead */}
      {el.type === "balloon" && el.tail && !el.attachTo &&
        ["speech", "whisper", "double", "thought"].includes(el.kind) && (() => {
        const t = Math.atan2(el.tail.dy, el.tail.dx);
        const ex = el.w / 2 + (el.w / 2) * Math.cos(t);
        const ey = el.h / 2 + (el.h / 2) * Math.sin(t);
        const bx = el.tail.bx ?? (ex + el.w / 2 + el.tail.dx) / 2 - el.w / 2;
        const by = el.tail.by ?? (ey + el.h / 2 + el.tail.dy) / 2 - el.h / 2;
        const [vx, vy] = vis(el.x + el.w / 2 + bx, el.y + el.h / 2 + by);
        return (
          <div className="handle tailBow" title="Drag to bend the tail"
            style={{ left: (vx - el.x) * z - 6, top: (vy - el.y) * z - 6 }}
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
        /* connector controls follow the carried mapping across the spine */
        const vM = vis(el.x + M[0], el.y + M[1]);
        const v1 = vis(el.x + h1[0], el.y + h1[1]);
        const v2 = vis(el.x + h2[0], el.y + h2[1]);
        return (
          <>
            {showTilt && (
              <svg style={{ position: "absolute", left: 0, top: 0, width: 1, height: 1, overflow: "visible", pointerEvents: "none" }}>
                <line x1={(v1[0] - el.x) * z} y1={(v1[1] - el.y) * z}
                  x2={(v2[0] - el.x) * z} y2={(v2[1] - el.y) * z} stroke="#777" strokeWidth={1} />
              </svg>
            )}
            {showTilt && (
              <div className="handle tiltDot" title="Tilt the connector"
                style={{ left: (v1[0] - el.x) * z - 5, top: (v1[1] - el.y) * z - 5 }}
                onPointerDown={(e) => startDrag(e, el, "tilt", "t1")} />
            )}
            {showTilt && (
              <div className="handle tiltDot" title="Tilt the connector"
                style={{ left: (v2[0] - el.x) * z - 5, top: (v2[1] - el.y) * z - 5 }}
                onPointerDown={(e) => startDrag(e, el, "tilt", "t2")} />
            )}
            <div className="handle connMove"
              title="Drag to curve the connecting tail — drop it inside another bubble to join that one instead · double-click to tilt"
              style={{ left: (vM[0] - el.x) * z - 7, top: (vM[1] - el.y) * z - 7 }}
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
