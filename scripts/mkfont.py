#!/usr/bin/env python3
"""LMC font family generator — original comic lettering typefaces built
from scratch. Every glyph is a hand-authored stroke skeleton, expanded to
outlines with round caps/joins and deterministic hand-lettered wobble.
No existing font's outlines are used or referenced. Licensed OFL 1.1.

Families (each in Regular / Bold / Italic / Bold Italic):
  LMC Dialogue — balanced everyday dialogue caps
  LMC Agent    — crisp, tidy dialogue caps (minimal wobble)
  LMC Hero     — round, friendly, heavier dialogue caps with a slight lean
  LMC Alley    — loose, condensed, scrawled hand caps with heavy bounce
  LMC Whisper  — thin, airy, wavering caps for whispers and asides
  LMC Shout    — heavy, narrow, leaning display caps for yelling and SFX
  LMC Horror   — rough caps with dripping strokes

Usage: pip install fonttools skia-pathops brotli && python3 mkfont.py <outdir>
"""
import math, hashlib, io, os, sys
from pathops import Path, union
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import woff2

UPM, CAP = 1000, 700

def arc(cx, cy, rx, ry, a0, a1, n=18):
    return [(cx + rx * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + ry * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def ringpts(cx, cy, rx, ry, n=28):
    return arc(cx, cy, rx, ry, 0, 360, n)

def quad(p0, c, p1, n=12):
    return [((1-t)**2*p0[0] + 2*(1-t)*t*c[0] + t*t*p1[0],
             (1-t)**2*p0[1] + 2*(1-t)*t*c[1] + t*t*p1[1]) for t in [i/n for i in range(n+1)]]

def chain(*segs):
    out = []
    for s in segs:
        out.extend(s if not out else s[1:])
    return out

L = lambda *pts: list(pts)

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

# lowercase set for mixed-case families (x-height 480, desc to -190)
LOWER_GLYPHS = {
    "a": (430, [ringpts(205, 240, 160, 225, 24), L((365, 455), (365, 0))]),
    "b": (440, [L((70, 700), (70, 0)), ringpts(245, 240, 160, 225, 24)]),
    "c": (400, [arc(225, 240, 160, 225, 55, 305)]),
    "d": (440, [L((375, 700), (375, 0)), ringpts(205, 240, 160, 225, 24)]),
    "e": (420, [arc(212, 240, 160, 225, 35, 330), L((62, 290), (355, 290))]),
    "f": (300, [chain(arc(215, 585, 110, 115, 90, 180), L((105, 585), (105, 0))), L((30, 460), (245, 460))]),
    "g": (440, [ringpts(205, 255, 160, 205, 24),
                chain(L((365, 460), (365, -70)), arc(230, -70, 135, 120, 0, -180, 10))]),
    "h": (440, [L((70, 700), (70, 0)), arc(225, 262, 155, 218, 180, 0), L((380, 262), (380, 0))]),
    "i": (170, [L((85, 480), (85, 0)), L((85, 622), (85, 626))]),
    "j": (270, [chain(L((180, 480), (180, -80)), arc(70, -80, 110, 110, 0, -140, 10)), L((180, 622), (180, 626))]),
    "k": (400, [L((70, 700), (70, 0)), L((330, 470), (75, 205)), L((160, 290), (345, 0))]),
    "l": (180, [L((90, 700), (90, 0))]),
    "m": (620, [L((65, 480), (65, 0)), arc(175, 272, 110, 208, 180, 0), L((285, 272), (285, 0)),
                arc(395, 272, 110, 208, 180, 0), L((505, 272), (505, 0))]),
    "n": (440, [L((70, 480), (70, 0)), arc(225, 265, 155, 215, 180, 0), L((380, 265), (380, 0))]),
    "o": (440, [ringpts(220, 240, 165, 230, 24)]),
    "p": (440, [L((70, 480), (70, -190)), ringpts(245, 240, 160, 225, 24)]),
    "q": (440, [ringpts(205, 240, 160, 225, 24), L((365, 480), (365, -190))]),
    "r": (330, [L((70, 480), (70, 0)), arc(195, 292, 125, 185, 180, 20, 12)]),
    "s": (380, [chain(quad((330, 430), (240, 530), (140, 445)), quad((140, 445), (45, 360), (165, 285)),
                      quad((165, 285), (320, 215), (315, 120)), quad((315, 120), (300, 15), (160, 32)),
                      quad((160, 32), (60, 42), (48, 108)))]),
    "t": (320, [L((140, 660), (140, 0)), L((40, 470), (260, 470))]),
    "u": (440, [chain(L((70, 480), (70, 145)), arc(225, 145, 155, 145, 180, 360), L((380, 145), (380, 480)))]),
    "v": (420, [L((45, 480), (210, 0)), L((210, 0), (375, 480))]),
    "w": (600, [L((40, 480), (155, 0)), L((155, 0), (295, 400)), L((295, 400), (435, 0)), L((435, 0), (550, 480))]),
    "x": (420, [L((50, 480), (370, 0)), L((370, 480), (50, 0))]),
    "y": (430, [L((55, 480), (215, 60)), L((375, 480), (120, -190))]),
    "z": (400, [L((55, 480), (345, 480)), L((345, 480), (55, 0)), L((55, 0), (345, 0))]),
}

CMAP_EXTRA = {
    "zero":"0","one":"1","two":"2","three":"3","four":"4","five":"5","six":"6",
    "seven":"7","eight":"8","nine":"9","period":".","comma":",","exclam":"!",
    "question":"?","quotesingle":"'","quotedbl":'"',"hyphen":"-","colon":":",
    "semicolon":";","parenleft":"(","parenright":")","slash":"/","space":" ",
}

def ghash(name):
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)

def wobble(name, pts, amp, freq):
    ph = ghash(name)
    p1, p2, p3, p4 = ph % 7, (ph >> 3) % 7, (ph >> 6) % 7, (ph >> 9) % 7
    out = []
    for (x, y) in pts:
        dx = amp * math.sin(y * 0.011 * freq + p1) + amp * 0.6 * math.sin(x * 0.017 * freq + p2)
        dy = amp * math.sin(x * 0.012 * freq + p3) + amp * 0.6 * math.sin(y * 0.016 * freq + p4)
        out.append((x + dx, y + dy))
    return out

def drip_strokes(name, strokes):
    """dripping-paint strokes hanging from the letter's low points"""
    lows = sorted({round(p[0]) for s in strokes for p in s if p[1] < 40})
    if not lows:
        return []
    ph = ghash(name + "drip")
    picks = sorted({lows[(ph >> (i * 5)) % len(lows)] for i in range(min(2, len(lows)))})
    out = []
    for i, x in enumerate(picks):
        ln = 70 + ((ph >> (i * 7)) % 90)
        sway = ((ph >> (i * 3)) % 21) - 10
        out.append(([(x, 25), (x + sway * 0.4, -ln * 0.55), (x + sway, -ln)], 0.45))
    return out

def droplet_strokes(name, strokes):
    """little sneeze droplets scattered just off the letterforms"""
    pts = [p for s in strokes for p in s]
    if not pts:
        return []
    ph = ghash(name + "spot")
    out = []
    for i in range(5):
        p = pts[(ph >> (i * 4)) % len(pts)]
        ang = ((ph >> (i * 6)) % 360) * math.pi / 180
        dist = 95 + ((ph >> (i * 3)) % 60)
        x, y = p[0] + dist * math.cos(ang), p[1] + dist * math.sin(ang)
        rf = 0.22 + ((ph >> (i * 5)) % 10) / 55
        out.append(([(x, y), (x + 0.5, y)], rf))
    return out

def scribble_strokes(name, w):
    """asemic mumble-scrawl: every key renders an unreadable squiggle"""
    ph = ghash("mum" + name)
    n = 8 + ph % 6
    x0, x1 = 30, max(90, w - 30)
    base = 300 + (ph >> 4) % 90
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        amp = 150 if (ph >> (i * 2)) % 5 == 0 else 70
        y = base + (((ph >> (i * 3)) % (2 * amp)) - amp)
        pts.append((x, y))
    return [pts]

def alien_strokes(name, w):
    """alien sigils: every key renders an original geometric glyph"""
    ph = ghash("alien" + name)
    cx = w / 2
    out = []
    r0 = 110 + (ph >> 3) % 90
    kind = ph % 4
    if kind == 0:
        out.append(ringpts(cx, 300 + (ph >> 5) % 150, r0, r0, 20))
    elif kind == 1:
        a0 = (ph >> 4) % 360
        out.append(arc(cx, 360, r0, r0, a0, a0 + 180 + (ph >> 6) % 130))
    elif kind == 2:
        out.append([(cx - r0, 120), (cx, 520 + (ph >> 5) % 160), (cx + r0, 120)])
    else:
        out.append([(cx - r0 * 0.7, 640), (cx + r0 * 0.4, 60)])
    acc = (ph >> 8) % 3
    if acc == 0:
        out.append([(cx, 620), (cx + ((ph >> 10) % 80) - 40, 60)])
    elif acc == 1:
        out.append([(cx + r0 * 0.7, 110), (cx + r0 * 0.7, 114)])
    else:
        yb = 380 + (ph >> 7) % 220
        out.append([(cx - r0, yb), (cx + r0, yb)])
    return out

def capsule_path(p, q, r, cap="round", n=12):
    if cap == "square":
        # rectangle extended r beyond both endpoints — blocky chopped stroke
        a = math.atan2(q[1] - p[1], q[0] - p[0])
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        pts = [
            (q[0] + ux * r + px * r, q[1] + uy * r + py * r),
            (q[0] + ux * r - px * r, q[1] + uy * r - py * r),
            (p[0] - ux * r - px * r, p[1] - uy * r - py * r),
            (p[0] - ux * r + px * r, p[1] - uy * r + py * r),
        ]
    else:
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

def decimate(pts, k):
    """keep every k-th point (always keeping the last) — turns sampled
    curves into angular chunks"""
    if k <= 1 or len(pts) <= 2:
        return pts
    out = pts[::k]
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out

def build_glyph(name, strokes, r, amp, freq, shear, narrow, bounce, drips, cap="round", decim=0):
    stroke_list = [(s, 1.0) for s in strokes]
    if drips == "drips":
        stroke_list += drip_strokes(name, strokes)
    elif drips == "droplets":
        stroke_list += droplet_strokes(name, strokes)
    taper = drips == "taper"
    dy0 = (((ghash(name + "b") % 100) / 100) - 0.5) * 2 * bounce
    paths = []
    for stroke, rmul in stroke_list:
        pts = decimate(list(stroke), decim)
        if taper and len(pts) > 1:
            # densify so the brush profile has room to swell and thin out
            dense = [pts[0]]
            for i in range(len(pts) - 1):
                for k in range(1, 7):
                    t = k / 6
                    dense.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
                                  pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t))
            pts = dense
        pts = wobble(name, pts, amp, freq)
        pts = [(x * narrow, y + dy0) for (x, y) in pts]
        if shear:
            pts = [(x + y * shear, y) for (x, y) in pts]
        if len(pts) == 1:
            pts = pts + [(pts[0][0] + 0.5, pts[0][1])]
        if drips == "bubbles":
            # vapor cloud: the stroke becomes a string of varied dots
            ph2 = ghash(name + "bub")
            dense = [pts[0]]
            for i in range(len(pts) - 1):
                seg = math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
                steps = max(1, int(seg / 34))
                for k in range(1, steps + 1):
                    t = k / steps
                    dense.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
                                  pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t))
            for idx, p in enumerate(dense):
                rv = (r * rmul) * (0.55 + ((ph2 >> (idx % 23)) % 100) / 130)
                paths.append(capsule_path(p, (p[0] + 0.5, p[1]), rv, "round"))
            continue
        n_seg = len(pts) - 1
        for i in range(n_seg):
            rr = r * rmul
            if taper and n_seg > 1:
                # brush stroke: pointed entry/exit, full belly mid-stroke
                t = (i + 0.5) / n_seg
                rr *= 0.28 + 0.72 * (math.sin(math.pi * t) ** 0.6)
            paths.append(capsule_path(pts[i], pts[i + 1], rr, cap))
    if not paths:
        return None
    out = Path()
    union(paths, out.getPen())
    return out

def make_font(family, style, r, amp, freq, shear, narrow, bounce, drips, out_ttf, cap="round", decim=0, mixed=False):
    glyph_src = dict(GLYPHS)
    if mixed:
        glyph_src.update(LOWER_GLYPHS)
    names = [".notdef"] + list(glyph_src.keys())
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    cmap = {}
    for g in GLYPHS:
        if len(g) == 1 and g.isalpha():
            cmap[ord(g)] = g
            if not mixed:
                cmap[ord(g.lower())] = g
        elif g in CMAP_EXTRA:
            cmap[ord(CMAP_EXTRA[g])] = g
    if mixed:
        for g in LOWER_GLYPHS:
            cmap[ord(g)] = g
    fb.setupCharacterMap(cmap)
    glyphs, adv = {}, {}
    pen = TTGlyphPen(None)
    glyphs[".notdef"] = pen.glyph()
    adv[".notdef"] = 600
    for name, (w, strokes) in glyph_src.items():
        if drips == "scribble" and name != "space":
            strokes = scribble_strokes(name, w)
        elif drips == "alien" and name != "space":
            strokes = alien_strokes(name, w)
        path = build_glyph(name, strokes, r, amp, freq, shear, narrow, bounce, drips, cap, decim)
        pen = TTGlyphPen(None)
        if path is not None:
            path.draw(pen)
        glyphs[name] = pen.glyph()
        letter_h = CAP if name in GLYPHS else 480
        adv[name] = int(w * narrow + 60 + (letter_h * shear if shear else 0))
    fb.setupGlyf(glyphs)
    hmtx = {}
    for name in names:
        g = fb.font["glyf"][name]
        lsb = g.xMin if hasattr(g, "xMin") and g.numberOfContours else 0
        hmtx[name] = (adv.get(name, 600), lsb)
    fb.setupHorizontalMetrics(hmtx)
    fb.setupHorizontalHeader(ascent=800, descent=-260)
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-260, sTypoLineGap=90,
                usWinAscent=880, usWinDescent=320,
                sxHeight=490, sCapHeight=CAP, achVendID="LMC ",
                fsSelection=0x40 if style == "Regular" else (0x20 if style == "Bold" else 0x01),
                usWeightClass=700 if "Bold" in style else 400)
    ps = family.replace(" ", "") + "-" + style.replace(" ", "")
    fb.setupNameTable({
        "familyName": family, "styleName": style,
        "uniqueFontIdentifier": ps + "-1.0",
        "fullName": f"{family} {style}", "psName": ps,
        "version": "Version 1.000",
        "copyright": "Copyright 2026 LetterMyComic. An original typeface. Licensed under the SIL Open Font License 1.1.",
        "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1.",
        "licenseInfoURL": "https://openfontlicense.org",
    })
    fb.setupPost(italicAngle=-9.0 if "Italic" in style else 0.0)
    fb.save(out_ttf)
    out_woff2 = out_ttf.replace(".ttf", ".woff2")
    with open(out_ttf, "rb") as f:
        data = io.BytesIO(f.read())
    outbuf = io.BytesIO()
    woff2.compress(data, outbuf)
    with open(out_woff2, "wb") as f:
        f.write(outbuf.getvalue())
    print(f"{family} {style}: {os.path.basename(out_ttf)} {os.path.getsize(out_ttf)}B  woff2 {os.path.getsize(out_woff2)}B")

# family: (regular_r, bold_r, amp, freq, lean_deg, narrow, bounce, drips, cap, decim)
FAMILIES = {
    "LMC Dialogue": (46, 64, 5.0, 1.0, 0, 1.00, 0, "", "round", 0),
    "LMC Agent":    (52, 70, 2.5, 0.8, 0, 0.94, 0, "", "round", 0),
    "LMC Hero":     (78, 100, 4.0, 0.9, 3, 1.04, 6, "", "round", 0),
    "LMC Alley":    (34, 50, 10.0, 1.9, 1, 0.88, 18, "", "round", 0),
    "LMC Whisper":  (26, 40, 9.0, 1.6, 0, 1.02, 14, "", "round", 0),
    "LMC Shout":    (88, 108, 6.0, 1.3, 4, 0.84, 10, "", "round", 0),
    "LMC Horror":   (50, 68, 13.0, 2.6, 0, 0.95, 16, "drips", "round", 0),
    "LMC Brawl":    (80, 100, 3.0, 1.0, 2, 0.92, 8, "", "square", 5),
    "LMC Cosmos":   (42, 62, 1.2, 0.8, 0, 1.14, 0, "", "square", 4),
    "LMC Slasher":  (64, 84, 8.0, 2.2, 3, 0.90, 12, "", "square", 4),
    "LMC Sneeze":   (82, 102, 5.0, 1.0, 2, 1.02, 8, "droplets", "round", 0),
    "LMC Mumble":   (24, 36, 6.0, 1.3, 0, 1.00, 26, "scribble", "round", 0),
    "LMC Dragon":   (58, 76, 6.0, 1.1, 4, 0.98, 10, "taper", "round", 0),
    "LMC Alien":    (42, 58, 3.0, 1.0, 0, 1.00, 12, "alien", "round", 0),
    "LMC Vapor":    (32, 44, 4.0, 1.0, 0, 1.00, 8, "bubbles", "round", 0),
    # mixed-case casual dialogue hand — full lowercase set
    "LMC Casual":   (40, 56, 4.0, 1.0, 0, 1.00, 4, "", "round", 0, True),
}

def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    for family, cfg in FAMILIES.items():
        (r, rb, amp, freq, lean, narrow, bounce, drips, cap, decim) = cfg[:10]
        mixed = cfg[10] if len(cfg) > 10 else False
        base = family.replace(" ", "")
        lean_sh = math.tan(math.radians(lean))
        ital_sh = math.tan(math.radians(9 + lean))
        for style, rr, sh in [("Regular", r, lean_sh), ("Bold", rb, lean_sh),
                              ("Italic", r, ital_sh), ("Bold Italic", rb, ital_sh)]:
            fn = os.path.join(outdir, f"{base}-{style.replace(' ', '')}.ttf")
            make_font(family, style, rr, amp, freq, sh, narrow, bounce, drips, fn, cap, decim, mixed)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
