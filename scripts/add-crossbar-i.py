#!/usr/bin/env python3
"""Add a real crossbar "I" glyph to every bundled font.

The comic-lettering convention: the pronoun "I" gets a bar above and below
(a serifed capital), every other I is a plain stem. The studio used to fake
it with combining macrons, which no comic font positions — the bars floated
off the letter. This gives each font its own crossbar I, built from the
font's actual I stem, at Private Use codepoint U+E000; the app substitutes
that character for the pronoun (lib/model.ts applyCrossbarI).

- fonts whose I is already serifed (bbox wider than ~0.32 of its height)
  get U+E000 mapped to the existing I — nothing to add;
- TrueType outlines get a new glyph "I.crossbar": the I's contours plus two
  bars as wide as 2.4 stems and as thick as the stem, centred on it; the
  advance grows if the bars would overhang;
- CFF fonts (rare here) just map U+E000 to I.

Idempotent: a font that already maps U+E000 is skipped. Run:
    python3 scripts/add-crossbar-i.py            # all of public/fonts
    python3 scripts/add-crossbar-i.py path.ttf   # one file
"""
import os, sys, glob
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.recordingPen import DecomposingRecordingPen

PUA = 0xE000
NAME = "I.crossbar"
ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "fonts")

def flatten(ops, n=12):
    """recorded pen ops → straight segments [(x0,y0,x1,y1)] (curves sampled)"""
    from fontTools.pens.basePen import decomposeQuadraticSegment
    segs, cur, start = [], None, None
    def line(a, b):
        segs.append((a[0], a[1], b[0], b[1]))
    def cubic(p0, p1, p2, p3):
        prev = p0
        for i in range(1, n + 1):
            t = i / n; u = 1 - t
            p = (u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
                 u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1])
            line(prev, p); prev = p
    def quad(p0, p1, p2):
        prev = p0
        for i in range(1, n + 1):
            t = i / n; u = 1 - t
            p = (u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0], u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1])
            line(prev, p); prev = p
    for op, args in ops:
        if op == "moveTo":
            cur = start = args[0]
        elif op == "lineTo":
            line(cur, args[0]); cur = args[0]
        elif op == "curveTo":
            pts = (cur,) + tuple(args)
            # cubic (3 args) — longer runs are split by basePen normally; handle 3
            if len(args) == 3:
                cubic(cur, args[0], args[1], args[2]); cur = args[2]
            else:
                for a in args: line(cur, a); cur = a
        elif op == "qCurveTo":
            pts = list(args)
            if pts[-1] is None:  # closed quad contour without on-curve points
                pts = pts[:-1] + [((pts[0][0] + pts[-2][0]) / 2, (pts[0][1] + pts[-2][1]) / 2)]
            for c, p in decomposeQuadraticSegment(pts):
                quad(cur, c, p); cur = p
        elif op in ("closePath", "endPath"):
            if cur is not None and start is not None and cur != start:
                line(cur, start)
            cur = start
    return segs

def crossings(segs, y):
    xs = []
    for (ax, ay, bx, by) in segs:
        if (ay <= y < by) or (by <= y < ay):
            xs.append(ax + (bx - ax) * (y - ay) / (by - ay))
    return sorted(xs)

def process(path: str) -> str:
    try:
        font = TTFont(path)
    except Exception as e:  # noqa: BLE001
        return f"skip (unreadable: {e})"
    cmap = font.getBestCmap() or {}
    if PUA in cmap:
        return "already done"
    gI = cmap.get(ord("I"))
    if not gI:
        return "skip (no I)"
    gs = font.getGlyphSet()
    bp = BoundsPen(gs)
    gs[gI].draw(bp)
    if not bp.bounds:
        return "skip (empty I)"
    x0, y0, x1, y1 = bp.bounds
    bw, bh = x1 - x0, y1 - y0
    adv, lsb = font["hmtx"][gI]
    rec = DecomposingRecordingPen(gs)
    gs[gI].draw(rec)
    segs = flatten(rec.value)
    # the stem's real width, measured across the letter at several heights
    # (an italic's bounding box is far wider than its slanted stem)
    widths, centres = [], {}
    for f in (0.3, 0.5, 0.7):
        c = crossings(segs, y0 + bh * f)
        if len(c) >= 2:
            widths.append(c[-1] - c[0])
    stem = sorted(widths)[len(widths) // 2] if widths else bw
    # already serifed when the letter's ends are clearly wider than its stem
    # (a bounding-box ratio misread heavy condensed faces as serifed)
    # measured at the ENDS of the stem (not the bounding box) so an italic's
    # slant does not read as serifs
    ends = [crossings(segs, y0 + bh * f) for f in (0.06, 0.94)]
    endw = max((c[-1] - c[0]) for c in ends if len(c) >= 2) if any(len(c) >= 2 for c in ends) else bw
    serifed = bh <= 0 or stem <= 0 or endw > stem * 1.6
    # the bars must wind the same way as the stem's outer contour, or the
    # nonzero fill cancels where they overlap (a hatched, hollow letter)
    def signed_area(contour):
        a = 0.0
        for (ax, ay, bx2, by2) in contour:
            a += ax * by2 - bx2 * ay
        return a / 2
    contours, cur = [], []
    for seg in segs:
        if cur and (abs(cur[-1][2] - seg[0]) > 1e-6 or abs(cur[-1][3] - seg[1]) > 1e-6):
            contours.append(cur); cur = []
        cur.append(seg)
    if cur: contours.append(cur)
    outer = max(contours, key=lambda c: abs(signed_area(c))) if contours else []
    clockwise = signed_area(outer) < 0 if outer else True
    target = gI
    if not serifed and "glyf" in font:
        thick = max(1.0, stem * 0.95)
        half = stem * 1.2
        # each bar is centred on the stem where it meets that bar
        def centre_at(y):
            c = crossings(segs, y)
            return (c[0] + c[-1]) / 2 if len(c) >= 2 else (x0 + x1) / 2
        bars = []
        for (ya, yb) in ((y1 - thick, y1), (y0, y0 + thick)):
            cx = centre_at((ya + yb) / 2 if ya > y0 else y0 + thick * 1.5)
            bars.append((cx - half, cx + half, ya, yb))
        bx0 = min(b[0] for b in bars); bx1 = max(b[1] for b in bars)
        # keep the letter inside its advance: shift right if the bars overhang
        # the left, widen the advance if they overhang the right
        pad = stem * 0.35
        shift = pad - bx0 if bx0 < pad else 0.0
        from fontTools.pens.transformPen import TransformPen
        pen = TTGlyphPen(gs)
        tp = TransformPen(pen, (1, 0, 0, 1, shift, 0))
        rec.replay(tp)
        for (bxa, bxb, ya, yb) in bars:
            pts = [(bxa, yb), (bxb, yb), (bxb, ya), (bxa, ya)]
            if not clockwise: pts.reverse()
            tp.moveTo(pts[0]); tp.lineTo(pts[1]); tp.lineTo(pts[2]); tp.lineTo(pts[3]); tp.closePath()
        glyph = pen.glyph()
        glyph.recalcBounds(font["glyf"])
        newAdv = max(adv + shift, bx1 + shift + pad)
        order = font.getGlyphOrder()
        if NAME in order:
            return "skip (name taken)"
        # glyf.__setitem__ appends the name to the (shared) glyph order itself
        font["glyf"][NAME] = glyph
        font["hmtx"][NAME] = (int(round(newAdv)), int(round(min(x0, bx0) + shift)))
        if "vmtx" in font:
            font["vmtx"][NAME] = font["vmtx"][gI]
        if NAME not in font.getGlyphOrder():
            font.setGlyphOrder(font.getGlyphOrder() + [NAME])
        target = NAME
    # map U+E000 in every unicode subtable
    added = False
    for st in font["cmap"].tables:
        if st.isUnicode():
            st.cmap[PUA] = target
            added = True
    if not added:
        return "skip (no unicode cmap)"
    flavor = font.flavor
    font.save(path)
    return "bars added" if target == NAME else "serifed — mapped"

def main(argv):
    files = argv or sorted(glob.glob(os.path.join(ROOT, "*.ttf")) + glob.glob(os.path.join(ROOT, "*.otf")) + glob.glob(os.path.join(ROOT, "*.woff2")) + glob.glob(os.path.join(ROOT, "*.woff")))
    tally = {}
    for f in files:
        try:
            r = process(f)
        except Exception as e:  # noqa: BLE001
            import traceback; traceback.print_exc()
            r = f"skip (error: {type(e).__name__}: {e})"
        tally[r.split(" (")[0]] = tally.get(r.split(" (")[0], 0) + 1
        if r.startswith("skip"):
            print(os.path.basename(f), "→", r)
    print({k: v for k, v in tally.items()})

if __name__ == "__main__":
    main(sys.argv[1:])
