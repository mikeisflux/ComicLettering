/* ComicLettering Studio — an original, fully client-side comic lettering app.
   No servers, no uploads: pages, images and projects live in the browser. */
"use strict";

/* ============================== constants ============================== */

const FONTS = {
  comic:  { label: "Comic",       css: '"Comic Sans MS","Comic Sans","Chalkboard SE","Segoe Print",cursive' },
  marker: { label: "Marker",      css: '"Marker Felt","Segoe Print","Bradley Hand",cursive' },
  impact: { label: "Impact",      css: 'Impact,"Arial Black","Haettenschweiler",sans-serif' },
  sans:   { label: "Sans",        css: 'Arial,Helvetica,sans-serif' },
  serif:  { label: "Serif",       css: 'Georgia,"Times New Roman",serif' },
  mono:   { label: "Typewriter",  css: '"Courier New",Courier,monospace' },
};

const FILTERS = {
  none:  { label: "None",          css: "" },
  bw:    { label: "Black & White", css: "grayscale(1) contrast(1.1)" },
  sepia: { label: "Sepia",         css: "sepia(0.85)" },
  vivid: { label: "Vivid",         css: "saturate(1.7) contrast(1.12)" },
  faded: { label: "Faded",         css: "saturate(0.55) brightness(1.12)" },
  noir:  { label: "Noir",          css: "grayscale(1) contrast(1.6) brightness(0.9)" },
};

const PAGE_SIZES = [
  { k: "comic",  label: 'US Comic (1500×2250)',  w: 1500, h: 2250 },
  { k: "manga",  label: "Manga B5 (1516×2150)",  w: 1516, h: 2150 },
  { k: "a4",     label: "A4 Portrait (1654×2339)", w: 1654, h: 2339 },
  { k: "square", label: "Square (2000×2000)",    w: 2000, h: 2000 },
  { k: "strip",  label: "Web Strip (1800×600)",  w: 1800, h: 600 },
];

/* Panel layouts as [x, y, w, h] fractions of the page content area. */
const LAYOUTS = {
  "1":  [[0, 0, 1, 1]],
  "2h": [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
  "2v": [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  "3t": [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  "3r": [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]],
  "4":  [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  "6":  [[0, 0, 0.5, 1 / 3], [0.5, 0, 0.5, 1 / 3], [0, 1 / 3, 0.5, 1 / 3], [0.5, 1 / 3, 0.5, 1 / 3], [0, 2 / 3, 0.5, 1 / 3], [0.5, 2 / 3, 0.5, 1 / 3]],
  "9":  [[0, 0, 1 / 3, 1 / 3], [1 / 3, 0, 1 / 3, 1 / 3], [2 / 3, 0, 1 / 3, 1 / 3], [0, 1 / 3, 1 / 3, 1 / 3], [1 / 3, 1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 3, 1 / 3, 1 / 3], [0, 2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 1 / 3, 1 / 3], [2 / 3, 2 / 3, 1 / 3, 1 / 3]],
};

const BALLOON_KINDS = { speech: "Speech", thought: "Thought", shout: "Shout", whisper: "Whisper", caption: "Caption" };
const AUTOSAVE_KEY = "comiclettering.autosave.v1";
const MIN_SIZE = 24;

/* ============================== state ============================== */

let doc = null;
let pageIndex = 0;
let zoom = 0.35;
let selId = null;
let editingId = null;
let idCounter = 1;
let history = [];
let hIndex = -1;
let drag = null;
let userZoomed = false;
const imgCache = new Map();

const $ = (s) => document.querySelector(s);
const pageEl = $("#page");
const stageEl = $("#stage");
const overlayEl = $("#overlay");

const uid = () => "e" + (idCounter++);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const deg2rad = (d) => (d * Math.PI) / 180;
const rotVec = (x, y, deg) => {
  const r = deg2rad(deg), c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
};
const curPage = () => doc.pages[pageIndex];
const getEl = (id) => curPage().els.find((e) => e.id === id);
const selEl = () => (selId ? getEl(selId) : null);

/* ============================== document model ============================== */

function newPage(w = 1500, h = 2250) {
  return { w, h, bg: "#ffffff", els: [] };
}

function newDoc() {
  const d = { app: "comiclettering", version: 1, pages: [newPage()] };
  return d;
}

function baseEl(type, x, y, w, h) {
  return { id: uid(), type, x, y, w, h, rot: 0 };
}

function makeBalloon(kind, x, y, w, h) {
  const el = baseEl("balloon", x, y, w, h);
  Object.assign(el, {
    kind,
    text: kind === "caption" ? "Meanwhile..." : "Your text here",
    font: kind === "caption" ? "serif" : "comic",
    size: 42,
    bold: kind === "shout",
    italic: kind === "caption",
    caps: kind !== "caption",
    align: "center",
    color: "#111111",
    fill: kind === "caption" ? "#fff7c9" : "#ffffff",
    stroke: "#111111",
    strokeW: kind === "shout" ? 5 : 3,
    tail: kind === "caption" ? null : { dx: -w * 0.25, dy: h * 0.85 },
  });
  return el;
}

function makePanel(x, y, w, h) {
  const el = baseEl("panel", x, y, w, h);
  Object.assign(el, { fill: "#ffffff", borderW: 6, borderC: "#111111", img: null, filter: "none" });
  return el;
}

function makeImage(x, y, w, h, dataURL) {
  const el = baseEl("image", x, y, w, h);
  Object.assign(el, { img: dataURL, filter: "none", borderW: 0, borderC: "#111111" });
  return el;
}

function makeSfx(x, y, w, h) {
  const el = baseEl("sfx", x, y, w, h);
  Object.assign(el, {
    text: "POW!", font: "impact", size: 120, bold: true, italic: false, caps: true,
    align: "center", color: "#ffd21f", outlineC: "#111111", outlineW: 8,
  });
  return el;
}

function applyLayout(page, key) {
  const fracs = LAYOUTS[key];
  if (!fracs) return;
  const m = Math.round(page.w * 0.035);
  const g = Math.round(page.w * 0.02);
  const cw = page.w - 2 * m, ch = page.h - 2 * m;
  const panels = fracs.map(([fx, fy, fw, fh]) => {
    const x0 = m + fx * cw + (fx > 0.001 ? g / 2 : 0);
    const x1 = m + (fx + fw) * cw - (fx + fw < 0.999 ? g / 2 : 0);
    const y0 = m + fy * ch + (fy > 0.001 ? g / 2 : 0);
    const y1 = m + (fy + fh) * ch - (fy + fh < 0.999 ? g / 2 : 0);
    return makePanel(Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0));
  });
  page.els = [...panels, ...page.els.filter((e) => e.type !== "panel")];
}

function starterDoc() {
  const d = newDoc();
  const p = d.pages[0];
  applyLayout(p, "4");
  const b = makeBalloon("speech", p.w * 0.16, p.h * 0.1, 560, 330);
  b.text = "Welcome! Double-click me and start lettering.";
  const c = makeBalloon("caption", p.w * 0.55, p.h * 0.56, 520, 170);
  c.text = "Drop your artwork onto the panels...";
  p.els.push(b, c);
  return d;
}

/* ============================== balloon geometry ============================== */

function ellipsePt(cx, cy, rx, ry, th) {
  return [cx + rx * Math.cos(th), cy + ry * Math.sin(th)];
}
const fmt = (n) => (Math.round(n * 100) / 100);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPt = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];

function circleSub(cx, cy, r) {
  return ` M ${fmt(cx + r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx - r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx + r)} ${fmt(cy)} Z`;
}

/* Returns { d, textRect:[x,y,w,h], dash } in element-local coordinates. */
function balloonGeom(el) {
  const w = el.w, h = el.h, cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
  const tail = el.tail;
  const tip = tail ? [cx + tail.dx, cy + tail.dy] : null;

  if (el.kind === "caption") {
    const p = Math.max(8, Math.min(w, h) * 0.12);
    return { d: `M 0 0 H ${fmt(w)} V ${fmt(h)} H 0 Z`, textRect: [p, p, w - 2 * p, h - 2 * p], dash: null };
  }

  if (el.kind === "thought") {
    const K = 14;
    let d = "";
    const brx = rx * 0.88, bry = ry * 0.88;
    const crx = rx * 1.1, cry = ry * 1.1;
    const p0 = ellipsePt(cx, cy, brx, bry, 0);
    d = `M ${fmt(p0[0])} ${fmt(p0[1])}`;
    for (let i = 0; i < K; i++) {
      const a1 = ((i + 1) / K) * Math.PI * 2;
      const am = ((i + 0.5) / K) * Math.PI * 2;
      const p1 = ellipsePt(cx, cy, brx, bry, a1);
      const c = ellipsePt(cx, cy, crx, cry, am);
      d += ` Q ${fmt(c[0])} ${fmt(c[1])} ${fmt(p1[0])} ${fmt(p1[1])}`;
    }
    d += " Z";
    if (tip) {
      const t = Math.atan2(tail.dy, tail.dx);
      const E = ellipsePt(cx, cy, rx, ry, t);
      const base = Math.min(w, h);
      [[0.32, 0.085], [0.62, 0.055], [0.88, 0.035]].forEach(([f, rf]) => {
        const c = lerpPt(E, tip, f);
        d += circleSub(c[0], c[1], Math.max(3, base * rf));
      });
    }
    return { d, textRect: [w * 0.18, h * 0.18, w * 0.64, h * 0.64], dash: null };
  }

  if (el.kind === "shout") {
    const N = 12;
    const irx = rx * 0.72, iry = ry * 0.72;
    const wob = [1, 0.93, 1.06, 0.97, 1.02, 0.9];
    const tAng = tip ? Math.atan2(tail.dy, tail.dx) : null;
    let tailIdx = -1, best = 1e9;
    const pts = [];
    for (let j = 0; j < N * 2; j++) {
      const th = (j / (N * 2)) * Math.PI * 2;
      if (j % 2 === 0) {
        const k = wob[(j / 2) % wob.length];
        pts.push(ellipsePt(cx, cy, rx * k, ry * k, th));
        if (tAng !== null) {
          let dd = Math.abs(Math.atan2(Math.sin(th - tAng), Math.cos(th - tAng)));
          if (dd < best) { best = dd; tailIdx = j; }
        }
      } else {
        pts.push(ellipsePt(cx, cy, irx, iry, th));
      }
    }
    if (tailIdx >= 0 && tip) pts[tailIdx] = tip;
    let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
    for (let j = 1; j < pts.length; j++) d += ` L ${fmt(pts[j][0])} ${fmt(pts[j][1])}`;
    d += " Z";
    return { d, textRect: [w * 0.22, h * 0.22, w * 0.56, h * 0.56], dash: null };
  }

  /* speech + whisper: ellipse with a curved, tapering tail */
  let d;
  if (!tip) {
    d = `M ${fmt(cx + rx)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx - rx)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx + rx)} ${fmt(cy)} Z`;
  } else {
    const t = Math.atan2(tail.dy, tail.dx);
    const delta = 0.42;
    const A = ellipsePt(cx, cy, rx, ry, t + delta);
    const B = ellipsePt(cx, cy, rx, ry, t - delta);
    const E = ellipsePt(cx, cy, rx, ry, t);
    const mB = lerpPt(lerpPt(B, tip, 0.45), lerpPt(E, tip, 0.45), 0.55);
    const mA = lerpPt(lerpPt(tip, A, 0.55), lerpPt(tip, E, 0.55), 0.55);
    d = `M ${fmt(A[0])} ${fmt(A[1])}` +
        ` A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(B[0])} ${fmt(B[1])}` +
        ` Q ${fmt(mB[0])} ${fmt(mB[1])} ${fmt(tip[0])} ${fmt(tip[1])}` +
        ` Q ${fmt(mA[0])} ${fmt(mA[1])} ${fmt(A[0])} ${fmt(A[1])} Z`;
  }
  return {
    d,
    textRect: [w * 0.17, h * 0.19, w * 0.66, h * 0.62],
    dash: el.kind === "whisper" ? [10, 9] : null,
  };
}

/* ============================== editor rendering ============================== */

function renderAll() {
  renderPage();
  renderOverlay();
  renderInspector();
  renderPageList();
  $("#btnUndo").disabled = hIndex <= 0;
  $("#btnRedo").disabled = hIndex >= history.length - 1;
}

function renderPage() {
  const p = curPage();
  pageEl.style.width = p.w + "px";
  pageEl.style.height = p.h + "px";
  pageEl.style.background = p.bg;
  stageEl.style.width = p.w * zoom + "px";
  stageEl.style.height = p.h * zoom + "px";
  pageEl.style.transform = `scale(${zoom})`;
  pageEl.style.transformOrigin = "0 0";
  pageEl.innerHTML = "";
  for (const el of p.els) pageEl.appendChild(buildElDom(el));
}

function buildElDom(el) {
  const div = document.createElement("div");
  div.className = "el " + el.type + (el.type === "sfx" ? " sfxwrap" : "");
  div.dataset.id = el.id;

  if (el.type === "panel" || el.type === "image") {
    if (el.img) {
      const img = document.createElement("img");
      img.className = "cover";
      img.src = el.img;
      img.draggable = false;
      div.appendChild(img);
    }
  } else if (el.type === "balloon") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.appendChild(path);
    div.appendChild(svg);
    div.appendChild(makeTxtDiv(el));
  } else if (el.type === "sfx") {
    div.appendChild(makeTxtDiv(el));
  }
  applyElStyle(div, el);
  return div;
}

function makeTxtDiv(el) {
  const t = document.createElement("div");
  t.className = "txt";
  t.spellcheck = false;
  t.textContent = el.text;
  return t;
}

function applyElStyle(div, el) {
  div.style.left = el.x + "px";
  div.style.top = el.y + "px";
  div.style.width = el.w + "px";
  div.style.height = el.h + "px";
  div.style.transform = el.rot ? `rotate(${el.rot}deg)` : "";

  if (el.type === "panel") {
    div.style.background = el.fill;
    div.style.border = el.borderW > 0 ? `${el.borderW}px solid ${el.borderC}` : "none";
    const img = div.querySelector("img");
    if (img) img.style.filter = FILTERS[el.filter]?.css || "";
    div.style.overflow = "hidden";
  } else if (el.type === "image") {
    div.style.border = el.borderW > 0 ? `${el.borderW}px solid ${el.borderC}` : "none";
    div.style.overflow = "hidden";
    const img = div.querySelector("img");
    if (img) img.style.filter = FILTERS[el.filter]?.css || "";
  } else if (el.type === "balloon") {
    const svg = div.querySelector("svg");
    const path = svg.querySelector("path");
    svg.setAttribute("width", el.w);
    svg.setAttribute("height", el.h);
    const g = balloonGeom(el);
    path.setAttribute("d", g.d);
    path.setAttribute("fill", el.fill);
    path.setAttribute("stroke", el.stroke);
    path.setAttribute("stroke-width", el.strokeW);
    path.setAttribute("stroke-linejoin", "round");
    if (g.dash) path.setAttribute("stroke-dasharray", g.dash.join(" "));
    else path.removeAttribute("stroke-dasharray");
    styleTxt(div.querySelector(".txt"), el, g.textRect);
  } else if (el.type === "sfx") {
    styleTxt(div.querySelector(".txt"), el, [0, 0, el.w, el.h]);
    const t = div.querySelector(".txt");
    t.style.webkitTextStroke = el.outlineW > 0 ? `${el.outlineW}px ${el.outlineC}` : "";
    t.style.paintOrder = "stroke fill";
  }
}

function styleTxt(t, el, rect) {
  t.style.left = rect[0] + "px";
  t.style.top = rect[1] + "px";
  t.style.width = rect[2] + "px";
  t.style.height = rect[3] + "px";
  t.style.fontFamily = FONTS[el.font]?.css || FONTS.comic.css;
  t.style.fontSize = el.size + "px";
  t.style.fontWeight = el.bold ? "700" : "400";
  t.style.fontStyle = el.italic ? "italic" : "normal";
  t.style.color = el.color;
  t.style.textAlign = el.align;
  t.style.textTransform = el.caps ? "uppercase" : "none";
}

function domFor(id) {
  return pageEl.querySelector(`.el[data-id="${id}"]`);
}

/* ---------- selection overlay ---------- */

function renderOverlay() {
  const el = selEl();
  if (!el) { overlayEl.hidden = true; return; }
  overlayEl.hidden = false;
  overlayEl.classList.toggle("editing", editingId === el.id);
  const z = zoom;
  overlayEl.style.left = el.x * z + "px";
  overlayEl.style.top = el.y * z + "px";
  overlayEl.style.width = el.w * z + "px";
  overlayEl.style.height = el.h * z + "px";
  overlayEl.style.transform = el.rot ? `rotate(${el.rot}deg)` : "";
  overlayEl.style.setProperty("--hs", "12px");
  overlayEl.style.setProperty("--bw", "1.5px");

  let html = '<div class="box"></div>';
  const H = [["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5], ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5]];
  for (const [k, fx, fy] of H) {
    html += `<div class="handle h-${k}" data-h="${k}" style="left:calc(${fx * 100}% - var(--hs)/2);top:calc(${fy * 100}% - var(--hs)/2)"></div>`;
  }
  html += `<div class="handle rot" data-h="rot" title="Rotate (hold Shift to snap)" style="left:calc(50% - var(--hs)/2);top:-28px"></div>`;
  if (el.type === "balloon" && el.tail) {
    const tx = (el.w / 2 + el.tail.dx) * z, ty = (el.h / 2 + el.tail.dy) * z;
    html += `<div class="handle tail" data-h="tail" title="Drag to aim the balloon tail" style="left:calc(${tx}px - var(--hs)/2);top:calc(${ty}px - var(--hs)/2)"></div>`;
  }
  overlayEl.innerHTML = html;
}

/* ---------- pages sidebar ---------- */

function renderPageList() {
  const list = $("#pageList");
  list.innerHTML = "";
  doc.pages.forEach((p, i) => {
    const t = document.createElement("div");
    t.className = "page-thumb" + (i === pageIndex ? " current" : "");
    t.style.setProperty("--ar", (p.w / p.h).toFixed(3));
    t.style.background = p.bg;
    t.textContent = String(i + 1);
    t.title = "Page " + (i + 1);
    t.onclick = () => { pageIndex = i; select(null); renderAll(); fitZoom(false); };
    list.appendChild(t);
  });
}

/* ============================== inspector ============================== */

function fld(label, node) {
  const d = document.createElement("div");
  d.className = "fld";
  const l = document.createElement("label");
  l.textContent = label;
  d.append(l, node);
  return d;
}
function mkSelect(options, value, on) {
  const s = document.createElement("select");
  for (const [k, lab] of options) {
    const o = document.createElement("option");
    o.value = k; o.textContent = lab;
    s.appendChild(o);
  }
  s.value = value;
  s.onchange = () => on(s.value);
  return s;
}
function mkNum(value, min, max, on) {
  const i = document.createElement("input");
  i.type = "number"; i.min = min; i.max = max; i.value = value;
  i.onchange = () => on(clamp(+i.value || 0, min, max));
  return i;
}
function mkColor(value, on) {
  const i = document.createElement("input");
  i.type = "color"; i.value = value;
  i.oninput = () => on(i.value, false);
  i.onchange = () => on(i.value, true);
  return i;
}
function mkCheck(value, on) {
  const i = document.createElement("input");
  i.type = "checkbox"; i.checked = value;
  i.onchange = () => on(i.checked);
  return i;
}
function section(title) {
  const d = document.createElement("div");
  d.className = "insp-section";
  const h = document.createElement("div");
  h.className = "insp-head"; h.textContent = title;
  d.appendChild(h);
  return d;
}

/* Update model value; light repaint, full commit on final. */
function setProp(el, key, val, final = true) {
  el[key] = val;
  const dom = domFor(el.id);
  if (dom) applyElStyle(dom, el);
  renderOverlay();
  if (final) { commit(); renderInspector(); }
}

function renderInspector() {
  const body = $("#inspectorBody");
  body.innerHTML = "";
  const el = selEl();
  if (!el) { renderPageInspector(body); return; }

  const sType = section(
    el.type === "balloon" ? BALLOON_KINDS[el.kind] + " balloon"
    : el.type === "sfx" ? "SFX lettering"
    : el.type === "panel" ? "Panel" : "Image");
  body.appendChild(sType);

  if (el.type === "balloon") {
    sType.appendChild(fld("Type", mkSelect(Object.entries(BALLOON_KINDS), el.kind, (v) => {
      el.kind = v;
      if (v === "caption") el.tail = null;
      else if (!el.tail) el.tail = { dx: -el.w * 0.25, dy: el.h * 0.85 };
      setProp(el, "kind", v);
    })));
  }

  if (el.type === "balloon" || el.type === "sfx") {
    const sT = section("Lettering");
    sT.appendChild(fld("Font", mkSelect(Object.entries(FONTS).map(([k, f]) => [k, f.label]), el.font, (v) => setProp(el, "font", v))));
    sT.appendChild(fld("Size", mkNum(el.size, 8, 600, (v) => setProp(el, "size", v))));
    sT.appendChild(fld("Bold", mkCheck(el.bold, (v) => setProp(el, "bold", v))));
    sT.appendChild(fld("Italic", mkCheck(el.italic, (v) => setProp(el, "italic", v))));
    sT.appendChild(fld("ALL CAPS", mkCheck(el.caps, (v) => setProp(el, "caps", v))));
    sT.appendChild(fld("Align", mkSelect([["left", "Left"], ["center", "Center"], ["right", "Right"]], el.align, (v) => setProp(el, "align", v))));
    sT.appendChild(fld("Text color", mkColor(el.color, (v, f) => setProp(el, "color", v, f))));
    body.appendChild(sT);
  }

  if (el.type === "balloon") {
    const sS = section("Balloon style");
    sS.appendChild(fld("Fill", mkColor(el.fill, (v, f) => setProp(el, "fill", v, f))));
    sS.appendChild(fld("Outline", mkColor(el.stroke, (v, f) => setProp(el, "stroke", v, f))));
    sS.appendChild(fld("Line width", mkNum(el.strokeW, 0, 30, (v) => setProp(el, "strokeW", v))));
    body.appendChild(sS);
  }

  if (el.type === "sfx") {
    const sS = section("Outline");
    sS.appendChild(fld("Color", mkColor(el.outlineC, (v, f) => setProp(el, "outlineC", v, f))));
    sS.appendChild(fld("Width", mkNum(el.outlineW, 0, 40, (v) => setProp(el, "outlineW", v))));
    body.appendChild(sS);
  }

  if (el.type === "panel" || el.type === "image") {
    const sI = section(el.type === "panel" ? "Frame" : "Style");
    if (el.type === "panel") sI.appendChild(fld("Fill", mkColor(el.fill, (v, f) => setProp(el, "fill", v, f))));
    sI.appendChild(fld("Border", mkNum(el.borderW, 0, 40, (v) => setProp(el, "borderW", v))));
    sI.appendChild(fld("Border color", mkColor(el.borderC, (v, f) => setProp(el, "borderC", v, f))));
    sI.appendChild(fld("Photo filter", mkSelect(Object.entries(FILTERS).map(([k, f]) => [k, f.label]), el.filter, (v) => setProp(el, "filter", v))));
    const row = document.createElement("div");
    row.className = "btn-row";
    const bPick = document.createElement("button");
    bPick.textContent = el.img ? "Replace image…" : "Set image…";
    bPick.onclick = () => pickPanelImage(el.id);
    row.appendChild(bPick);
    if (el.img && el.type === "panel") {
      const bClr = document.createElement("button");
      bClr.textContent = "Remove image";
      bClr.onclick = () => { el.img = null; commit(); renderAll(); };
      row.appendChild(bClr);
    }
    sI.appendChild(row);
    body.appendChild(sI);
  }

  const sA = section("Arrange");
  const r1 = document.createElement("div"); r1.className = "btn-row";
  [["To front", () => reorder(el, +1e9)], ["Forward", () => reorder(el, +1)],
   ["Backward", () => reorder(el, -1)], ["To back", () => reorder(el, -1e9)]]
    .forEach(([lab, fn]) => { const b = document.createElement("button"); b.textContent = lab; b.onclick = fn; r1.appendChild(b); });
  sA.appendChild(r1);
  const r2 = document.createElement("div"); r2.className = "btn-row";
  const bDup = document.createElement("button"); bDup.textContent = "Duplicate (Ctrl+D)"; bDup.onclick = () => duplicateSel();
  const bDel = document.createElement("button"); bDel.textContent = "Delete"; bDel.onclick = () => deleteSel();
  r2.append(bDup, bDel);
  sA.appendChild(r2);
  sA.appendChild(fld("Rotation °", mkNum(Math.round(el.rot), -180, 180, (v) => setProp(el, "rot", v))));
  body.appendChild(sA);
}

function renderPageInspector(body) {
  const p = curPage();
  const sP = section("Page");
  sP.appendChild(fld("Size", mkSelect(
    [...PAGE_SIZES.map((s) => [s.k, s.label]), ["custom", "Custom"]],
    PAGE_SIZES.find((s) => s.w === p.w && s.h === p.h)?.k || "custom",
    (v) => {
      const s = PAGE_SIZES.find((x) => x.k === v);
      if (s) { p.w = s.w; p.h = s.h; commit(); renderAll(); fitZoom(false); }
    })));
  sP.appendChild(fld("Width px", mkNum(p.w, 200, 6000, (v) => { p.w = v; commit(); renderAll(); fitZoom(false); })));
  sP.appendChild(fld("Height px", mkNum(p.h, 200, 6000, (v) => { p.h = v; commit(); renderAll(); fitZoom(false); })));
  sP.appendChild(fld("Background", mkColor(p.bg, (v, f) => {
    p.bg = v; pageEl.style.background = v;
    if (f) { commit(); renderPageList(); }
  })));
  body.appendChild(sP);

  const sL = section("Panel layout");
  const grid = document.createElement("div");
  grid.className = "layout-grid";
  for (const [key, fracs] of Object.entries(LAYOUTS)) {
    const b = document.createElement("button");
    b.className = "layout-btn";
    b.title = fracs.length + (fracs.length === 1 ? " panel" : " panels");
    let svg = '<svg viewBox="0 0 60 84">';
    for (const [fx, fy, fw, fh] of fracs) {
      svg += `<rect x="${4 + fx * 52}" y="${4 + fy * 76}" width="${fw * 52 - 2}" height="${fh * 76 - 2}"/>`;
    }
    svg += "</svg>";
    b.innerHTML = svg;
    b.onclick = () => { applyLayout(curPage(), key); commit(); renderAll(); };
    grid.appendChild(b);
  }
  sL.appendChild(grid);
  const note = document.createElement("div");
  note.style.cssText = "color:var(--dim);font-size:11px;margin-top:6px";
  note.textContent = "Applying a layout replaces the page's panels; balloons and images are kept.";
  sL.appendChild(note);
  body.appendChild(sL);

  const sTip = section("Tips");
  sTip.innerHTML += `<div style="color:var(--dim);font-size:12px;line-height:1.6">
    Select an element to edit its style here.<br>
    Double-click balloons to type.<br>
    Drag image files straight onto the page.<br>
    Ctrl+Z undo &middot; Ctrl+D duplicate &middot; arrows nudge.</div>`;
  body.appendChild(sTip);
}

function reorder(el, delta) {
  const els = curPage().els;
  const i = els.indexOf(el);
  if (i < 0) return;
  els.splice(i, 1);
  const j = clamp(i + delta, 0, els.length);
  els.splice(j, 0, el);
  commit(); renderAll();
}

/* ============================== selection & editing ============================== */

function select(id) {
  if (editingId && editingId !== id) stopEditing(false);
  selId = id;
  renderOverlay();
  renderInspector();
}

function startEditing(el) {
  const dom = domFor(el.id);
  const t = dom?.querySelector(".txt");
  if (!t) return;
  editingId = el.id;
  try { t.contentEditable = "plaintext-only"; } catch { /* Firefox */ }
  if (t.contentEditable !== "plaintext-only") t.contentEditable = "true";
  t.focus();
  const range = document.createRange();
  range.selectNodeContents(t);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  renderOverlay();
}

function stopEditing(fromBlur) {
  if (!editingId) return;
  const el = getEl(editingId);
  const dom = domFor(editingId);
  const t = dom?.querySelector(".txt");
  editingId = null;
  if (el && t) {
    const txt = t.innerText.replace(/ /g, " ").replace(/\n$/, "");
    if (txt !== el.text) { el.text = txt; commit(); }
    t.contentEditable = "false";
    t.blur();
  }
  renderOverlay();
}

function deleteSel() {
  const el = selEl();
  if (!el) return;
  const els = curPage().els;
  els.splice(els.indexOf(el), 1);
  select(null);
  commit(); renderAll();
}

function duplicateSel() {
  const el = selEl();
  if (!el) return;
  const copy = JSON.parse(JSON.stringify(el));
  copy.id = uid();
  copy.x += 40; copy.y += 40;
  curPage().els.push(copy);
  commit(); renderAll();
  select(copy.id);
}

/* ============================== pointer interaction ============================== */

function pagePoint(e) {
  const r = pageEl.getBoundingClientRect();
  return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
}

pageEl.addEventListener("pointerdown", (e) => {
  const elDom = e.target.closest(".el");
  if (!elDom) { select(null); return; }
  const el = getEl(elDom.dataset.id);
  if (!el) return;
  if (editingId === el.id) return; // typing — let the caret work
  e.preventDefault();
  select(el.id);
  const p = pagePoint(e);
  drag = { mode: "move", start: p, orig: JSON.parse(JSON.stringify(el)), id: el.id, moved: false };
});

overlayEl.addEventListener("pointerdown", (e) => {
  const h = e.target.dataset?.h;
  if (!h || !selEl()) return;
  e.preventDefault(); e.stopPropagation();
  const el = selEl();
  drag = {
    mode: h === "rot" ? "rotate" : h === "tail" ? "tail" : "resize",
    handle: h, start: pagePoint(e),
    orig: JSON.parse(JSON.stringify(el)), id: el.id, moved: false,
  };
});

window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const el = getEl(drag.id);
  if (!el) { drag = null; return; }
  const p = pagePoint(e);
  const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
  const o = drag.orig;

  if (drag.mode === "move") {
    el.x = Math.round(o.x + dx);
    el.y = Math.round(o.y + dy);
  } else if (drag.mode === "resize") {
    const [ldx, ldy] = rotVec(dx, dy, -o.rot);
    const h = drag.handle;
    if (h.includes("e")) el.w = Math.max(MIN_SIZE, o.w + ldx);
    if (h.includes("s")) el.h = Math.max(MIN_SIZE, o.h + ldy);
    if (h.includes("w")) { el.w = Math.max(MIN_SIZE, o.w - ldx); el.x = o.x + (o.w - el.w); }
    if (h.includes("n")) { el.h = Math.max(MIN_SIZE, o.h - ldy); el.y = o.y + (o.h - el.h); }
    el.w = Math.round(el.w); el.h = Math.round(el.h);
    el.x = Math.round(el.x); el.y = Math.round(el.y);
  } else if (drag.mode === "rotate") {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    let ang = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
    if (e.shiftKey) ang = Math.round(ang / 15) * 15;
    if (Math.abs(((ang % 360) + 360) % 360) < 3 || Math.abs(((ang % 360) + 360) % 360) > 357) ang = 0;
    el.rot = Math.round(ang * 10) / 10;
  } else if (drag.mode === "tail") {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const [ldx, ldy] = rotVec(p.x - cx, p.y - cy, -o.rot);
    el.tail = { dx: Math.round(ldx), dy: Math.round(ldy) };
  }

  const dom = domFor(el.id);
  if (dom) applyElStyle(dom, el);
  renderOverlay();
});

window.addEventListener("pointerup", () => {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  if (moved) { commit(); renderInspector(); }
});

pageEl.addEventListener("dblclick", (e) => {
  const elDom = e.target.closest(".el");
  if (!elDom) return;
  const el = getEl(elDom.dataset.id);
  if (!el) return;
  if (el.type === "balloon" || el.type === "sfx") {
    select(el.id);
    startEditing(el);
  } else if (el.type === "panel" || el.type === "image") {
    pickPanelImage(el.id);
  }
});

pageEl.addEventListener("focusout", (e) => {
  if (editingId && e.target.classList?.contains("txt")) stopEditing(true);
});

/* live-sync text while typing so the model never goes stale */
pageEl.addEventListener("input", (e) => {
  if (!editingId || !e.target.classList?.contains("txt")) return;
  const el = getEl(editingId);
  if (el) el.text = e.target.innerText.replace(/ /g, " ");
});

/* drag & drop image files */
["dragover", "dragenter"].forEach((t) =>
  $("#canvasArea").addEventListener(t, (e) => e.preventDefault()));
$("#canvasArea").addEventListener("drop", async (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return;
  const p = pagePoint(e);
  let off = 0;
  for (const f of files) {
    await addImageFromFile(f, p.x + off, p.y + off);
    off += 60;
  }
});

/* ============================== keyboard ============================== */

window.addEventListener("keydown", (e) => {
  const inField = e.target.closest?.("input, select, textarea") || e.target.isContentEditable;
  if (e.key === "Escape") {
    if (editingId) { stopEditing(false); renderAll(); }
    else select(null);
    return;
  }
  if (inField) return;

  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); return; }
  if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveJSON(); return; }

  const el = selEl();
  if (!el) return;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); return; }
  const step = e.shiftKey ? 10 : 2;
  let dxy = null;
  if (e.key === "ArrowLeft") dxy = [-step, 0];
  if (e.key === "ArrowRight") dxy = [step, 0];
  if (e.key === "ArrowUp") dxy = [0, -step];
  if (e.key === "ArrowDown") dxy = [0, step];
  if (dxy) {
    e.preventDefault();
    el.x += dxy[0]; el.y += dxy[1];
    const dom = domFor(el.id);
    if (dom) applyElStyle(dom, el);
    renderOverlay();
    commitSoon();
  }
});

let commitTimer = null;
function commitSoon() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(() => commit(), 400);
}

/* ============================== add elements ============================== */

function centerSpawn(w, h) {
  const p = curPage();
  const n = p.els.length % 5;
  return { x: Math.round(p.w / 2 - w / 2 + n * 40), y: Math.round(p.h * 0.3 + n * 40) };
}

function addFromTray(kind) {
  const p = curPage();
  if (kind === "panel") {
    const w = Math.round(p.w * 0.42), h = Math.round(w * 0.75);
    const { x, y } = centerSpawn(w, h);
    const el = makePanel(x, y, w, h);
    p.els.push(el); commit(); renderAll(); select(el.id);
  } else if (kind === "image") {
    $("#fileImage").click();
  } else if (kind === "sfx") {
    const w = Math.round(p.w * 0.4), h = Math.round(p.w * 0.16);
    const { x, y } = centerSpawn(w, h);
    const el = makeSfx(x, y, w, h);
    p.els.push(el); commit(); renderAll(); select(el.id);
  } else {
    const w = kind === "caption" ? Math.round(p.w * 0.36) : Math.round(p.w * 0.34);
    const h = kind === "caption" ? Math.round(w * 0.32) : Math.round(w * 0.62);
    const { x, y } = centerSpawn(w, h);
    const el = makeBalloon(kind, x, y, w, h);
    p.els.push(el); commit(); renderAll(); select(el.id);
  }
}

document.querySelectorAll(".tray-btn").forEach((b) =>
  b.addEventListener("click", () => addFromTray(b.dataset.add)));

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src));
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { imgCache.set(src, img); res(img); };
    img.onerror = rej;
    img.src = src;
  });
}

async function addImageFromFile(file, x, y) {
  const url = await readFileAsDataURL(file);
  const img = await loadImage(url);
  const p = curPage();
  const w = Math.min(Math.round(p.w * 0.45), img.naturalWidth);
  const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
  const el = makeImage(Math.round((x ?? p.w / 2) - w / 2), Math.round((y ?? p.h / 2) - h / 2), w, h, url);
  p.els.push(el);
  commit(); renderAll(); select(el.id);
}

$("#fileImage").addEventListener("change", async (e) => {
  for (const f of e.target.files) await addImageFromFile(f);
  e.target.value = "";
});

let panelImageTarget = null;
function pickPanelImage(id) {
  panelImageTarget = id;
  $("#filePanelImage").click();
}
$("#filePanelImage").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  const el = panelImageTarget && getEl(panelImageTarget);
  panelImageTarget = null;
  if (!f || !el) return;
  el.img = await readFileAsDataURL(f);
  await loadImage(el.img);
  commit(); renderAll(); select(el.id);
});

/* ============================== history & persistence ============================== */

function commit() {
  history = history.slice(0, hIndex + 1);
  history.push(JSON.stringify(doc));
  if (history.length > 60) history.shift();
  hIndex = history.length - 1;
  autosave();
  $("#btnUndo").disabled = hIndex <= 0;
  $("#btnRedo").disabled = true;
}

function restore(json) {
  doc = JSON.parse(json);
  pageIndex = clamp(pageIndex, 0, doc.pages.length - 1);
  select(null);
  reseedIds();
  renderAll();
}

function undo() { if (hIndex > 0) { hIndex--; restore(history[hIndex]); autosave(); } }
function redo() { if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); autosave(); } }

function reseedIds() {
  let max = 0;
  for (const p of doc.pages) for (const e of p.els) {
    const n = parseInt(String(e.id).replace(/\D/g, ""), 10);
    if (!isNaN(n)) max = Math.max(max, n);
  }
  idCounter = max + 1;
}

function autosave() {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc));
    status("Autosaved ✓");
  } catch {
    status("Autosave skipped (project too large for browser storage) — use Save.");
  }
}

let statusTimer = null;
function status(msg) {
  const bar = $("#statusbar");
  bar.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    bar.textContent = "Double-click any balloon to type · drag the orange dot to aim the tail · Del removes · drop image files onto the page";
  }, 4000);
}

function saveJSON() {
  const blob = new Blob([JSON.stringify(doc, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "comic-project.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  status("Project saved as comic-project.json");
}

$("#fileOpen").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const txt = await f.text();
    const d = JSON.parse(txt);
    if (d.app !== "comiclettering" || !Array.isArray(d.pages)) throw new Error("not a ComicLettering project");
    doc = d;
    pageIndex = 0;
    select(null);
    reseedIds();
    history = []; hIndex = -1;
    commit();
    renderAll();
    fitZoom(true);
    status("Project opened.");
  } catch (err) {
    alert("Could not open that file: " + err.message);
  }
});

/* ============================== PNG export ============================== */

function wrapLines(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + " " + words[i];
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  return out;
}

function fontString(el) {
  return `${el.italic ? "italic " : ""}${el.bold ? "700 " : ""}${el.size}px ${FONTS[el.font]?.css || FONTS.comic.css}`;
}

function drawWrappedText(ctx, el, rect, outline) {
  const [rx, ry, rw, rh] = rect;
  ctx.font = fontString(el);
  ctx.textBaseline = "middle";
  const text = el.caps ? String(el.text).toUpperCase() : String(el.text);
  const lines = wrapLines(ctx, text, rw);
  const lineH = el.size * 1.25;
  let y = ry + rh / 2 - ((lines.length - 1) * lineH) / 2;
  for (const line of lines) {
    let x;
    if (el.align === "left") { ctx.textAlign = "left"; x = rx; }
    else if (el.align === "right") { ctx.textAlign = "right"; x = rx + rw; }
    else { ctx.textAlign = "center"; x = rx + rw / 2; }
    if (outline && el.outlineW > 0) {
      ctx.lineWidth = el.outlineW * 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = el.outlineC;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = el.color;
    ctx.fillText(line, x, y);
    y += lineH;
  }
}

function drawCover(ctx, img, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function withFilter(ctx, el, fn) {
  const css = FILTERS[el.filter]?.css;
  let applied = false;
  if (css && "filter" in ctx) {
    try { ctx.filter = css; applied = true; } catch { /* unsupported */ }
  }
  fn();
  if (applied) ctx.filter = "none";
}

async function renderPageToCanvas(p, scale = 1) {
  /* preload all images used on the page */
  const srcs = [];
  for (const el of p.els) if ((el.type === "panel" || el.type === "image") && el.img) srcs.push(el.img);
  await Promise.all(srcs.map((s) => loadImage(s).catch(() => null)));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(p.w * scale);
  canvas.height = Math.round(p.h * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, p.w, p.h);

  for (const el of p.els) {
    ctx.save();
    ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
    ctx.rotate(deg2rad(el.rot || 0));
    ctx.translate(-el.w / 2, -el.h / 2);

    if (el.type === "panel") {
      ctx.fillStyle = el.fill;
      ctx.fillRect(0, 0, el.w, el.h);
      const img = el.img ? imgCache.get(el.img) : null;
      if (img) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, el.w, el.h); ctx.clip();
        withFilter(ctx, el, () => drawCover(ctx, img, el.w, el.h));
        ctx.restore();
      }
      if (el.borderW > 0) {
        ctx.strokeStyle = el.borderC;
        ctx.lineWidth = el.borderW;
        ctx.strokeRect(el.borderW / 2, el.borderW / 2, el.w - el.borderW, el.h - el.borderW);
      }
    } else if (el.type === "image") {
      const img = el.img ? imgCache.get(el.img) : null;
      if (img) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, el.w, el.h); ctx.clip();
        withFilter(ctx, el, () => drawCover(ctx, img, el.w, el.h));
        ctx.restore();
      }
      if (el.borderW > 0) {
        ctx.strokeStyle = el.borderC;
        ctx.lineWidth = el.borderW;
        ctx.strokeRect(el.borderW / 2, el.borderW / 2, el.w - el.borderW, el.h - el.borderW);
      }
    } else if (el.type === "balloon") {
      const g = balloonGeom(el);
      const path = new Path2D(g.d);
      ctx.fillStyle = el.fill;
      ctx.fill(path);
      if (el.strokeW > 0) {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeW;
        ctx.lineJoin = "round";
        if (g.dash) ctx.setLineDash(g.dash);
        ctx.stroke(path);
        ctx.setLineDash([]);
      }
      drawWrappedText(ctx, el, g.textRect, false);
    } else if (el.type === "sfx") {
      drawWrappedText(ctx, el, [0, 0, el.w, el.h], true);
    }
    ctx.restore();
  }
  return canvas;
}

async function exportPNG() {
  status("Rendering page…");
  try {
    const canvas = await renderPageToCanvas(curPage(), 1);
    canvas.toBlob((blob) => {
      if (!blob) { status("Export failed."); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `comic-page-${pageIndex + 1}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      status(`Exported comic-page-${pageIndex + 1}.png`);
    }, "image/png");
  } catch (err) {
    status("Export failed: " + err.message);
  }
}

/* ============================== zoom & toolbar ============================== */

function setZoom(z, manual = true) {
  zoom = clamp(z, 0.05, 4);
  if (manual) userZoomed = true;
  $("#zoomLabel").textContent = Math.round(zoom * 100) + "%";
  renderPage();
  renderOverlay();
}

function fitZoom(force) {
  if (userZoomed && !force) { setZoom(zoom, false); return; }
  const area = $("#canvasArea");
  const p = curPage();
  const z = Math.min((area.clientWidth - 70) / p.w, (area.clientHeight - 70) / p.h);
  userZoomed = false;
  setZoom(clamp(z, 0.05, 2), false);
}

$("#btnZoomIn").onclick = () => setZoom(zoom * 1.2);
$("#btnZoomOut").onclick = () => setZoom(zoom / 1.2);
$("#btnZoomFit").onclick = () => { userZoomed = false; fitZoom(true); };
window.addEventListener("resize", () => fitZoom(false));

$("#btnUndo").onclick = () => undo();
$("#btnRedo").onclick = () => redo();
$("#btnSave").onclick = () => saveJSON();
$("#btnOpen").onclick = () => $("#fileOpen").click();
$("#btnExport").onclick = () => exportPNG();
$("#btnNew").onclick = () => {
  if (!confirm("Start a new document? Unsaved changes will be lost (last autosave is replaced too).")) return;
  doc = starterDoc();
  pageIndex = 0;
  select(null);
  history = []; hIndex = -1;
  commit();
  renderAll();
  fitZoom(true);
};

$("#btnAddPage").onclick = () => {
  const cur = curPage();
  doc.pages.splice(pageIndex + 1, 0, newPage(cur.w, cur.h));
  pageIndex++;
  select(null);
  commit(); renderAll();
};
$("#btnDelPage").onclick = () => {
  if (doc.pages.length <= 1) { status("A document needs at least one page."); return; }
  if (!confirm(`Delete page ${pageIndex + 1}?`)) return;
  doc.pages.splice(pageIndex, 1);
  pageIndex = clamp(pageIndex, 0, doc.pages.length - 1);
  select(null);
  commit(); renderAll();
};

/* ============================== boot ============================== */

(function boot() {
  let restored = null;
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d.app === "comiclettering" && Array.isArray(d.pages) && d.pages.length) restored = d;
    }
  } catch { /* ignore corrupt autosave */ }
  doc = restored || starterDoc();
  reseedIds();
  commit();
  renderAll();
  fitZoom(true);
  if (restored) status("Restored your last session from this browser.");
})();
