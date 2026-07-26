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

def flame_strokes(name, strokes):
    """Flame tongues licking up off the letter. Each tongue is a chain of
    segments whose stroke radius shrinks toward the tip, so it tapers to a
    point and curls sideways instead of reading as a fat sausage."""
    highs = sorted({round(p[0]) for s in strokes for p in s if p[1] > CAP - 70})
    if not highs:
        return []
    ph = ghash(name + "flame")
    span = (highs[-1] - highs[0]) or 1
    n = max(3, min(6, 2 + span // 90))          # more tongues on wider letters
    picks = sorted({highs[(ph >> (i * 4)) % len(highs)] for i in range(n)})
    out = []
    SEG = 7
    for i, x in enumerate(picks):
        ln = 300 + ((ph >> (i * 7)) % 260)      # tongue height
        sway = ((ph >> (i * 3)) % 85) - 42      # lateral lick
        curl = 1 if ((ph >> (i * 11)) & 1) else -1
        prev = (x, CAP - 55)
        for k in range(1, SEG + 1):
            t = k / SEG
            px = x + sway * (t ** 1.6) + curl * 30 * math.sin(t * 3.1)
            py = CAP - 55 + ln * t
            rmul = 0.85 * (1 - t) ** 0.8 + 0.05  # taper to a point
            out.append(([prev, (px, py)], rmul))
            prev = (px, py)
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
    if cap == "chamfer":
        # blocky stroke whose four corners are sliced off at 45° — chiselled
        # slab letterforms rather than round or dead-square ones
        a = math.atan2(q[1] - p[1], q[0] - p[0])
        ux, uy = math.cos(a), math.sin(a)
        px, py = -uy, ux
        corners = [
            (q[0] + ux * r + px * r, q[1] + uy * r + py * r),
            (q[0] + ux * r - px * r, q[1] + uy * r - py * r),
            (p[0] - ux * r - px * r, p[1] - uy * r - py * r),
            (p[0] - ux * r + px * r, p[1] - uy * r + py * r),
        ]
        c = r * 0.42
        pts = []
        for i, C in enumerate(corners):
            prev = corners[i - 1]
            nxt = corners[(i + 1) % 4]
            din = (C[0] - prev[0], C[1] - prev[1])
            dout = (nxt[0] - C[0], nxt[1] - C[1])
            ln = math.hypot(*din) or 1
            lo = math.hypot(*dout) or 1
            ci, co = min(c, ln / 2), min(c, lo / 2)
            pts.append((C[0] - din[0] / ln * ci, C[1] - din[1] / ln * ci))
            pts.append((C[0] + dout[0] / lo * co, C[1] + dout[1] / lo * co))
    elif cap == "square":
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

def build_glyph(name, strokes, r, amp, freq, shear, narrow, bounce, drips, cap="round", decim=0, rotd=0, rough=0):
    stroke_list = [(s, 1.0) for s in strokes]
    if drips == "drips":
        stroke_list += drip_strokes(name, strokes)
    elif drips == "droplets":
        stroke_list += droplet_strokes(name, strokes)
    elif drips == "flames":
        stroke_list += flame_strokes(name, strokes)
    taper = drips == "taper"
    dy0 = (((ghash(name + "b") % 100) / 100) - 0.5) * 2 * bounce
    # per-glyph tilt about the glyph's own centre — hand-lettered words never
    # sit perfectly level; each letter leans a little differently
    rot0 = (((ghash(name + "r") % 100) / 100) - 0.5) * 2 * math.radians(rotd)
    _all = [p for st in strokes for p in st]
    gcx = sum(p[0] for p in _all) / len(_all) if _all else 0
    gcy = sum(p[1] for p in _all) / len(_all) if _all else 0
    paths = []
    for stroke, rmul in stroke_list:
        pts = decimate(list(stroke), decim)
        if rough and len(pts) > 1:
            # chop the skeleton into short spans so each one can carry its own
            # width — that is what tears the outline instead of just bending it
            dense = [pts[0]]
            for i in range(len(pts) - 1):
                seg = math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
                steps = max(1, int(seg / 46))
                for k in range(1, steps + 1):
                    t = k / steps
                    dense.append((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t,
                                  pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t))
            pts = dense
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
        if rot0:
            ca, sa = math.cos(rot0), math.sin(rot0)
            pts = [((x - gcx) * ca - (y - gcy) * sa + gcx,
                    (x - gcx) * sa + (y - gcy) * ca + gcy) for (x, y) in pts]
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
            if rough:
                hh = ghash(f"{name}rgh{i}")
                rr *= 1 + rough * (((hh % 200) / 100) - 1)
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

def make_font(family, style, r, amp, freq, shear, narrow, bounce, drips, out_ttf, cap="round", decim=0, mixed=False, track=0, rotd=0, rough=0):
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
        path = build_glyph(name, strokes, r, amp, freq, shear, narrow, bounce, drips, cap, decim, rotd, rough)
        pen = TTGlyphPen(None)
        if path is not None:
            path.draw(pen)
        glyphs[name] = pen.glyph()
        letter_h = CAP if name in GLYPHS else 480
        adv[name] = int(max(w * narrow * 0.55,
                        w * narrow + 60 + max(0, r - 55) * 1.25 + track)
                        + (letter_h * shear * 0.45 if shear else 0))
    fb.setupGlyf(glyphs)
    hmtx = {}
    for name in names:
        g = fb.font["glyf"][name]
        lsb = g.xMin if hasattr(g, "xMin") and g.numberOfContours else 0
        hmtx[name] = (adv.get(name, 600), lsb)
    fb.setupHorizontalMetrics(hmtx)
    # flame tongues rise well above the cap line — give those families the
    # headroom or the tips get clipped by the line box
    asc = 1400 if drips == "flames" else 800
    fb.setupHorizontalHeader(ascent=asc, descent=-260)
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=-260, sTypoLineGap=90,
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

# family: (regular_r, bold_r, amp, freq, lean_deg, narrow, bounce, drips, cap,
#          decim, mixed, track, rotd, rough)
FAMILIES = {
    "LMC Dialogue": (46, 64, 5.0, 1.0, 0, 1.00, 0, "", "round", 0),
    "LMC Agent":    (52, 70, 2.5, 0.8, 0, 0.94, 0, "", "round", 0),
    "LMC Hero":     (78, 100, 4.0, 0.9, 3, 1.04, 6, "", "round", 0),
    "LMC Alley":    (34, 50, 10.0, 1.9, 1, 0.88, 18, "", "round", 0),
    "LMC Whisper":  (26, 40, 9.0, 1.6, 0, 1.02, 14, "", "round", 0),
    "LMC Shout":    (88, 108, 6.0, 1.3, 4, 0.84, 10, "", "round", 0),
    "LMC Horror":   (50, 68, 13.0, 2.6, 0, 0.95, 16, "drips", "round", 0),
    "LMC Brawl":    (80, 100, 3.0, 1.0, 2, 0.92, 38, "", "square", 5, False, 0, 4.5),
    "LMC Cosmos":   (42, 62, 1.2, 0.8, 0, 1.14, 0, "", "square", 4),
    "LMC Slasher":  (64, 84, 8.0, 2.2, 3, 0.90, 40, "", "square", 4, False, 0, 5.0),
    "LMC Sneeze":   (82, 102, 5.0, 1.0, 2, 1.02, 34, "droplets", "round", 0, False, 0, 4.0),
    "LMC Mumble":   (24, 36, 6.0, 1.3, 0, 1.00, 26, "scribble", "round", 0),
    "LMC Dragon":   (58, 76, 6.0, 1.1, 4, 0.98, 10, "taper", "round", 0),
    "LMC Alien":    (42, 58, 3.0, 1.0, 0, 1.00, 12, "alien", "round", 0),
    "LMC Vapor":    (32, 44, 4.0, 1.0, 0, 1.00, 8, "bubbles", "round", 0),
    # mixed-case casual dialogue hand — full lowercase set
    "LMC Casual":   (40, 56, 4.0, 1.0, 0, 1.00, 4, "", "round", 0, True),
    # --- display/SFX genres: tall condensed military, battle-damaged,
    #     slanted cartoon impact, and rough brush ---
    #     slanted cartoon impact, and rough brush ---
    # condensed families need SLIM strokes or the tight columns merge into blobs
    "LMC Armory":   (38, 52, 0.8, 0.6, 0, 0.70, 0, "", "square", 6),
    "LMC Breach":   (40, 54, 3.2, 2.4, 0, 0.72, 5, "", "square", 10),
    "LMC Kaboom":   (112, 138, 2.0, 0.9, 15, 0.94, 26, "", "round", 0, False, -70, 3.0),
    "LMC Brimstone": (60, 80, 9.0, 2.0, 6, 0.92, 10, "taper", "round", 0),
    # heaviest of all — doubles as bolder-than-bold dialogue and beefy SFX
    "LMC Bigbold":  (104, 128, 1.5, 0.8, 0, 1.02, 4, "", "round", 0),
    # upright chunky impact caps
    "LMC Slam":     (96, 120, 2.5, 1.0, 3, 0.96, 6, "", "square", 2),
    # bubbly, bouncy, soft-round
    "LMC Splash":   (86, 108, 3.5, 1.2, 5, 1.02, 68, "", "round", 0, False, -30, 7.0),
    # hard-leaning spiky shards
    "LMC Blitz":    (60, 78, 4.0, 1.4, 16, 0.78, 6, "", "square", 8),
    # rough horror brush, slanted
    "LMC Butcher":  (64, 82, 11.0, 3.0, 7, 0.88, 8, "", "square", 7),
    # fat rounded bubble/graffiti caps
    "LMC Blob":     (104, 126, 2.5, 0.9, 4, 1.22, 52, "", "round", 0, False, -95, 6.0),
    # tall condensed brush
    "LMC Frost":    (46, 62, 6.0, 1.6, 2, 0.72, 6, "taper", "round", 0),
    # heavy slanted brush
    "LMC Berserk":  (72, 92, 7.0, 1.5, 14, 0.94, 36, "taper", "round", 0, False, 0, 3.5),
    # serrated sawtooth horror
    "LMC Sawtooth": (58, 76, 9.0, 4.6, 3, 0.88, 5, "", "square", 7),
    # flame tongues licking off the caps
    "LMC Charflame":(58, 74, 11.0, 2.8, 3, 0.92, 30, "flames", "round", 4, False, 0, 3.5),
    # heavy leaning cartoon with knocked-about edges
    "LMC Crashland":(80, 100, 5.0, 1.3, 12, 0.96, 40, "", "round", 3, False, 0, 4.0),
    # chunky angular street-shout caps
    "LMC Rowdy":    (88, 110, 3.5, 1.2, 2, 0.94, 46, "", "square", 6, False, 0, 5.0),
    # monoline geometric — thin, even, circular
    "LMC Deco":     (24, 34, 0.4, 0.5, 0, 1.12, 0, "", "round", 0),
    # smooth heavy italic scream
    "LMC Screech":  (98, 124, 1.0, 0.7, 20, 0.90, 0, "", "round", 0, False, -60),
    # rough marker horror
    "LMC Gutspill": (64, 84, 13.0, 3.6, 4, 0.88, 44, "taper", "round", 3, False, 0, 5.5),
    # buzzing/vibrating electric edge — very high wobble frequency
    "LMC Feedback": (50, 66, 15.0, 11.0, 4, 0.86, 30, "", "square", 1, False, 0, 4.0),
    # chunky rounded marker
    "LMC Fullbleed":(86, 108, 4.0, 1.1, 4, 0.94, 42, "", "round", 0, False, 0, 5.0),
    # compact slanted brush
    "LMC Gamma":    (86, 108, 9.0, 2.2, 4, 0.98, 22, "", "chamfer", 0, False, -40, 3.0, 0.32),
    # fat clean block caps
    "LMC Glassjaw": (100, 124, 1.5, 0.8, 2, 0.98, 30, "", "round", 2, False, -20, 3.0),
    # jagged spiky shards
    "LMC Skrunch":  (58, 76, 10.0, 3.2, 3, 0.86, 36, "", "square", 5, False, 0, 5.5),
    # angular graffiti tag, tall and jammed together
    "LMC Killcrazy":(50, 68, 8.0, 2.2, 6, 0.80, 42, "", "square", 6, False, -55, 6.0),
    # solid chiselled block caps with 45-degree cut corners and slit counters
    "LMC Krakhead": (122, 146, 0.2, 0.4, 0, 1.06, 0, "", "chamfer", 3, False, -108, 0),
    # heavy chopped-edge cartoon impact caps
    "LMC Onetwo":   (94, 116, 4.5, 0.9, 0, 0.94, 16, "", "chamfer", 4, False, -62, 2.2),
    # chisel-marker SFX hand, three widths
    "LMC Efex":     (72, 92, 5.0, 1.3, 0, 0.98, 34, "", "chamfer", 3, False, -30, 4.0),
    "LMC Efex Cond":(56, 74, 5.5, 1.4, 0, 0.70, 34, "", "chamfer", 3, False, -38, 4.0),
    "LMC Efex Thin":(26, 38, 5.0, 1.3, 0, 0.96, 30, "", "chamfer", 3, False, -8, 4.0),
    # torn/ragged slanted brush SFX, three widths
    "LMC Efex Rough":(74, 94, 9.0, 2.4, 10, 0.96, 30, "", "chamfer", 0, False, -22, 3.5, 0.30),
    "LMC Efex Roughthin":(54, 70, 8.0, 2.2, 10, 1.00, 28, "", "chamfer", 0, False, -8, 3.5, 0.34),
    "LMC Efex Brush":(80, 100, 7.0, 2.0, 10, 0.96, 26, "taper", "chamfer", 0, False, -26, 3.0, 0.26),
    # tall condensed dry-brush scrawl
    "LMC Rawbones": (44, 58, 10.0, 2.4, 2, 0.74, 26, "taper", "round", 0, False, -16, 4.5, 0.36),
    # compact punchy impact caps
    "LMC Punch":    (96, 120, 2.0, 1.0, 4, 0.90, 28, "", "round", 1, False, -45, 3.0),
    # bold cartoon caps with a lively bounce
    "LMC Palooka":  (88, 110, 3.0, 1.2, 3, 0.98, 56, "", "round", 0, False, -25, 6.0),
    # smooth clean italic display with a full lowercase
    "LMC Slick":    (56, 74, 0.8, 0.6, 12, 0.94, 0, "", "round", 0, True, -20, 0),
}

def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    for family, cfg in FAMILIES.items():
        (r, rb, amp, freq, lean, narrow, bounce, drips, cap, decim) = cfg[:10]
        mixed = cfg[10] if len(cfg) > 10 else False
        track = cfg[11] if len(cfg) > 11 else 0
        rotd = cfg[12] if len(cfg) > 12 else 0
        rough = cfg[13] if len(cfg) > 13 else 0
        base = family.replace(" ", "")
        lean_sh = math.tan(math.radians(lean))
        ital_sh = math.tan(math.radians(9 + lean))
        for style, rr, sh in [("Regular", r, lean_sh), ("Bold", rb, lean_sh),
                              ("Italic", r, ital_sh), ("Bold Italic", rb, ital_sh)]:
            fn = os.path.join(outdir, f"{base}-{style.replace(' ', '')}.ttf")
            make_font(family, style, rr, amp, freq, sh, narrow, bounce, drips, fn, cap, decim, mixed, track, rotd, rough)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
