"""Sweep every generated face for the two faults that keep showing up:
   letters that collide with their neighbour, and counters the stroke sealed."""
import os, sys, glob
from fontTools.ttLib import TTFont

HOLED = ["A","B","D","O","P","Q","R","zero","six","eight","nine",
         "exclam","question","i","j",
         "a","b","d","e","g","o","p","q"]
MIN_GAP = 6     # design units of clear air between two of the same letter

def contours(glyf, name):
    g = glyf[name]
    if g.numberOfContours <= 0: return 0
    return g.numberOfContours

# faces whose glyphs are redrawn from scratch (scribble/alien scrawls, vapour
# dot clouds) have no conventional counters to keep
DECORATIVE = ("LMCAlien", "LMCMumble", "LMCVapor")
bad_collide, bad_holes = [], []
for path in sorted(glob.glob(os.path.join(sys.argv[1], "*-Regular.ttf")) +
                   glob.glob(os.path.join(sys.argv[1], "*-Bold.ttf"))):
    f = TTFont(path)
    glyf, hmtx = f["glyf"], f["hmtx"]
    fam = os.path.basename(path).replace(".ttf","")
    for name in glyf.keys():
        g = glyf[name]
        if not getattr(g, "numberOfContours", 0): continue
        adv, lsb = hmtx[name]
        g.recalcBounds(glyf)
        ink = g.xMax - g.xMin
        if adv - ink < MIN_GAP:
            bad_collide.append((fam, name, adv, int(ink), int(adv - ink)))
    if fam.split("-")[0] in DECORATIVE: 
        f.close(); continue
    for name in HOLED:
        if name not in glyf.keys(): continue
        if contours(glyf, name) < 2:
            bad_holes.append((fam, name))
    f.close()

print(f"COLLISIONS ({len(bad_collide)}):")
for x in bad_collide[:40]: print("  %-26s %-8s adv %4d ink %4d gap %4d" % x)
print(f"SEALED COUNTERS ({len(bad_holes)}):")
seen = {}
for fam, n in bad_holes: seen.setdefault(fam, []).append(n)
for fam, ns in list(seen.items())[:30]: print("  %-26s %s" % (fam, " ".join(ns)))
