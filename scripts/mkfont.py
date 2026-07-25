#!/usr/bin/env python3
"""LMC Dialogue — an original comic-book dialogue typeface, built from
scratch: every glyph is a hand-authored stroke skeleton, expanded to
outlines with round caps/joins and a light hand-lettered wobble.
No existing font's outlines are used or referenced. Licensed OFL 1.1."""
import math, hashlib
from pathops import Path, union
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import woff2
import io, os

UPM, CAP, DESC_LIM = 1000, 700, -220

def arc(cx, cy, rx, ry, a0, a1, n=18):
    """sampled elliptical arc, degrees"""
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def ringpts(cx, cy, rx, ry, n=28):
    return arc(cx, cy, rx, ry, 0, 360, n)

def quad(p0, c, p1, n=12):
    return [((1-t)**2*p0[0] + 2*(1-t)*t*c[0] + t*t*p1[0],
             (1-t)**2*p0[1] + 2*(1-t)*t*c[1] + t*t*p1[1]) for t in [i/n for i in range(n+1)]]

def chain(*segs):
    """join point lists, dropping duplicate joints"""
    out = []
    for s in segs:
        out.extend(s if not out else s[1:])
    return out

L = lambda *pts: list(pts)  # polyline stroke

# glyph -> (advance-ish width of drawing, [strokes])
GLYPHS = {
    "A": (500, [L((30,0),(250,700)), L((250,700),(470,0)), L((120,235),(385,235))]),
    "B": (480, [L((60,0),(60,700)),
                chain(L((60,700),(235,700)), arc(235,540,170,160,90,-90), L((235,380),(60,380))),
                chain(L((60,380),(245,380)), arc(245,190,195,190,90,-90), L((245,0),(60,0)))]),
    "C": (490, [arc(265,350,215,340,52,308)]),
    "D": (500, [L((60,0),(60,700)),
                chain(L((60,700),(205,700)), arc(205,350,235,350,90,-90), L((205,0),(60,0)))]),
    "E": (440, [L((60,0),(60,700)), L((60,700),(400,700)), L((60,365),(340,365)), L((60,0),(400,0))]),
    "F": (430, [L((60,0),(60,700)), L((60,700),(395,700)), L((60,365),(325,365))]),
    "G": (510, [arc(265,350,215,340,48,310),
                L((280,295),(465,295)), L((465,295),(465,140)), L((465,140),(408,95))]),
    "H": (510, [L((60,0),(60,700)), L((450,0),(450,700)), L((60,360),(450,360))]),
    "I": (170, [L((85,0),(85,700))]),
    "J": (430, [L((360,700),(360,135)), arc(230,135,130,150,0,-180)]),
    "K": (490, [L((60,0),(60,700)), L((430,700),(65,290)), L((195,395),(450,0))]),
    "L": (420, [L((60,0),(60,700)), L((60,0),(395,0))]),
    "M": (630, [L((50,0),(50,700)), L((50,700),(315,190)), L((315,190),(580,700)), L((580,700),(580,0))]),
    "N": (550, [L((60,0),(60,700)), L((60,700),(490,0)), L((490,0),(490,700))]),
    "O": (530, [ringpts(265,350,215,345)]),
    "P": (470, [L((60,0),(60,700)),
                chain(L((60,700),(235,700)), arc(235,520,180,180,90,-90), L((235,340),(60,340)))]),
    "Q": (530, [ringpts(265,350,215,345), L((330,190),(495,-45))]),
    "R": (490, [L((60,0),(60,700)),
                chain(L((60,700),(235,700)), arc(235,520,180,180,90,-90), L((235,340),(60,340))),
                L((205,340),(455,0))]),
    "S": (470, [chain(quad((405,600),(310,745),(165,655)), quad((165,655),(35,560),(150,430)),
                      quad((150,430),(335,385),(355,255)), quad((355,255),(390,110),(245,35)),
                      quad((245,35),(100,-45),(55,95)))]),
    "T": (470, [L((30,700),(440,700)), L((235,700),(235,0))]),
    "U": (510, [chain(L((60,700),(60,195)), arc(250,195,190,200,180,360), L((440,195),(440,700)))]),
    "V": (510, [L((40,700),(255,0)), L((255,0),(470,700))]),
    "W": (690, [L((35,700),(185,0)), L((185,0),(345,480)), L((345,480),(505,0)), L((505,0),(655,700))]),
    "X": (490, [L((40,700),(450,0)), L((450,700),(40,0))]),
    "Y": (490, [L((40,700),(245,335)), L((450,700),(245,335)), L((245,335),(245,0))]),
    "Z": (470, [L((50,700),(420,700)), L((420,700),(50,0)), L((50,0),(420,0))]),
    "zero":  (480, [ringpts(240,350,190,345)]),
    "one":   (300, [L((60,545),(195,700)), L((195,700),(195,0))]),
    "two":   (470, [chain(arc(230,510,175,185,175,-15), L((405,485),(70,0))), L((70,0),(420,0))]),
    "three": (460, [chain(arc(215,525,165,170,155,-90)), chain(arc(220,180,180,178,90,-155))]),
    "four":  (480, [L((335,700),(65,230)), L((65,230),(440,230)), L((335,505),(335,0))]),
    "five":  (470, [L((400,700),(100,700)), L((100,700),(88,395)),
                    chain(L((88,395),(160,430)), arc(230,215,185,220,110,-115))]),
    "six":   (480, [chain(quad((385,655),(175,765),(112,430)), L((112,430),(112,235))),
                    ringpts(245,222,138,218)]),
    "seven": (450, [L((55,700),(420,700)), L((420,700),(175,0))]),
    "eight": (480, [ringpts(240,515,168,168), ringpts(240,172,188,172)]),
    "nine":  (480, [ringpts(235,478,138,218), chain(quad((372,455),(390,140),(245,30)))]),
    "period":   (210, [L((105,40),(105,44))]),
    "comma":    (210, [L((115,70),(70,-130))]),
    "exclam":   (230, [L((115,700),(115,225)), L((115,40),(115,44))]),
    "question": (440, [chain(arc(215,520,165,175,180,-55), L((310,375),(218,268)), L((218,268),(218,205))),
                       L((218,40),(218,44))]),
    "quotesingle": (180, [L((90,700),(90,530))]),
    "quotedbl": (320, [L((90,700),(90,530)), L((230,700),(230,530))]),
    "hyphen":   (340, [L((55,300),(285,300))]),
    "colon":    (210, [L((105,420),(105,424)), L((105,40),(105,44))]),
    "semicolon":(210, [L((105,420),(105,424)), L((115,70),(70,-130))]),
    "parenleft": (320, [arc(330,280,215,540,115,245)]),
    "parenright":(320, [arc(-10,280,215,540,-65,65)]),
    "slash":    (400, [L((355,700),(45,-60))]),
    "space":    (280, []),
}

CMAP_EXTRA = {
    "zero":"0","one":"1","two":"2","three":"3","four":"4","five":"5","six":"6",
    "seven":"7","eight":"8","nine":"9","period":".","comma":",","exclam":"!",
    "question":"?","quotesingle":"'","quotedbl":'"',"hyphen":"-","colon":":",
    "semicolon":";","parenleft":"(","parenright":")","slash":"/","space":" ",
}

def wobble(name, pts, amp):
    ph = int(hashlib.md5(name.encode()).hexdigest()[:6], 16)
    p1, p2, p3, p4 = ph % 7, (ph >> 3) % 7, (ph >> 6) % 7, (ph >> 9) % 7
    out = []
    for (x, y) in pts:
        dx = amp * math.sin(y * 0.011 + p1) + amp * 0.6 * math.sin(x * 0.017 + p2)
        dy = amp * math.sin(x * 0.012 + p3) + amp * 0.6 * math.sin(y * 0.016 + p4)
        out.append((x + dx, y + dy))
    return out

def capsule_path(p, q, r, n=12):
    a = math.atan2(q[1] - p[1], q[0] - p[0])
    pts = []
    for i in range(n + 1):
        t = a - math.pi / 2 + math.pi * i / n
        pts.append((q[0] + r * math.cos(t), q[1] + r * math.sin(t)))
    for i in range(n + 1):
        t = a + math.pi / 2 + math.pi * i / n
        pts.append((p[0] + r * math.cos(t), p[1] + r * math.sin(t)))
    path = Path()
    pen = path.getPen()
    pen.moveTo(pts[0])
    for pt in pts[1:]:
        pen.lineTo(pt)
    pen.closePath()
    return path

def build_glyph(name, strokes, r, amp, shear):
    paths = []
    for stroke in strokes:
        pts = wobble(name, stroke, amp)
        if shear:
            pts = [(x + y * shear, y) for (x, y) in pts]
        if len(pts) == 1:
            pts = pts + [(pts[0][0] + 0.5, pts[0][1])]
        for i in range(len(pts) - 1):
            paths.append(capsule_path(pts[i], pts[i + 1], r))
    if not paths:
        return None
    out = Path()
    union(paths, out.getPen())
    return out

def make_font(style, r, amp, shear, out_ttf):
    names = [".notdef"] + list(GLYPHS.keys())
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    cmap = {}
    for g in GLYPHS:
        if len(g) == 1 and g.isalpha():
            cmap[ord(g)] = g
            cmap[ord(g.lower())] = g
        elif g in CMAP_EXTRA:
            cmap[ord(CMAP_EXTRA[g])] = g
    fb.setupCharacterMap(cmap)
    glyphs, metrics = {}, {}
    pen = TTGlyphPen(None)
    glyphs[".notdef"] = pen.glyph()
    metrics[".notdef"] = (600, 50)
    for name, (w, strokes) in GLYPHS.items():
        path = build_glyph(name, strokes, r, amp, shear)
        pen = TTGlyphPen(None)
        if path is not None:
            path.draw(pen)
        g = pen.glyph()
        glyphs[name] = g
        adv = int(w + 60 + (CAP * shear if shear else 0))
        metrics[name] = (adv, 0)
    fb.setupGlyf(glyphs)
    # recompute lsb from actual bounds
    hmtx = {}
    for name in names:
        g = fb.font["glyf"][name]
        lsb = g.xMin if hasattr(g, "xMin") and g.numberOfContours else 0
        hmtx[name] = (metrics.get(name, (600, 0))[0], lsb)
    fb.setupHorizontalMetrics(hmtx)
    fb.setupHorizontalHeader(ascent=800, descent=-220)
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-220, sTypoLineGap=90,
                usWinAscent=860, usWinDescent=260,
                sxHeight=490, sCapHeight=CAP,
                achVendID="LMC ",
                fsSelection=0x40 if style == "Regular" else (0x20 if style == "Bold" else 0x01),
                usWeightClass=700 if "Bold" in style else 400)
    st = style
    fb.setupNameTable({
        "familyName": "LMC Dialogue", "styleName": st,
        "uniqueFontIdentifier": f"LMCDialogue-{st}-1.0",
        "fullName": f"LMC Dialogue {st}", "psName": f"LMCDialogue-{st.replace(' ','')}",
        "version": "Version 1.000",
        "copyright": "Copyright 2026 LetterMyComic. An original typeface. Licensed under the SIL Open Font License 1.1.",
        "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
        "licenseInfoURL": "https://openfontlicense.org",
    })
    fb.setupPost(italicAngle=-9.0 if "Italic" in style else 0.0)
    fb.save(out_ttf)
    # woff2
    out_woff2 = out_ttf.replace(".ttf", ".woff2")
    with open(out_ttf, "rb") as f:
        data = io.BytesIO(f.read())
    outbuf = io.BytesIO()
    woff2.compress(data, outbuf)
    with open(out_woff2, "wb") as f:
        f.write(outbuf.getvalue())
    print(style, "->", out_ttf, os.path.getsize(out_ttf), "B /", out_woff2, os.path.getsize(out_woff2), "B")

OUT = os.path.dirname(os.path.abspath(__file__))
make_font("Regular", 46, 5.0, 0.0, os.path.join(OUT, "LMCDialogue-Regular.ttf"))
make_font("Bold", 64, 4.0, 0.0, os.path.join(OUT, "LMCDialogue-Bold.ttf"))
make_font("Italic", 46, 5.0, math.tan(math.radians(9)), os.path.join(OUT, "LMCDialogue-Italic.ttf"))
make_font("Bold Italic", 64, 4.0, math.tan(math.radians(9)), os.path.join(OUT, "LMCDialogue-BoldItalic.ttf"))
print("done")
