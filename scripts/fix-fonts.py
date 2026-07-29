#!/usr/bin/env python3
"""Sanitise the shipped webfonts so browsers stop rewriting them on load.

Firefox (and Chrome, quietly) run every downloaded font through OTS, which
repairs what it finds and logs what it repaired. Two complaints came from the
Google Fonts binaries in public/fonts, hundreds of lines per page load:

    glyf: Glyph bbox was incorrect; adjusting (glyph 66)
    gasp: Changed the version number to 1

Both are real defects in the files, not in how they are served.

A glyph's bounding box is stored in the font AND derivable from its outline;
where the two disagree the browser recomputes it. And `gasp` must declare
version 1 exactly when a range uses the version-1 smoothing bits — several of
these declare 0 while using them, so the browser corrects that too.

Neither breaks rendering; the browser repairs both. But the repair happens on
every load, on every machine, and hundreds of lines of it bury the errors that
do matter.

Fix them once, at rest. Nothing about the shapes changes — the outlines, the
character map and the advance widths come out byte-identical. Only the numbers
describing them start telling the truth.

Run after adding or regenerating any webfont:  python3 scripts/fix-fonts.py
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

FONT_DIR = Path(__file__).resolve().parent.parent / "public" / "fonts"

# gasp behaviour bits. The upper two were introduced with version 1, so a
# range using either forces the table to declare version 1.
GASP_GRIDFIT, GASP_DOGRAY = 0x01, 0x02
GASP_V1_BITS = 0x0C


def _gasp_version(ranges: dict[int, int]) -> int:
    """The version this table is required to declare, given its flags."""
    return 1 if any(b & GASP_V1_BITS for b in ranges.values()) else 0


def fix(path: Path) -> tuple[int, bool]:
    """Return (glyphs corrected, gasp bumped). Rewrites the file if either."""
    font = TTFont(str(path))
    fixed = 0
    gasp_bumped = False

    if "glyf" in font:
        glyf = font["glyf"]
        for name in font.getGlyphOrder():
            glyph = glyf[name]
            before = (
                (glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax)
                if glyph.numberOfContours != 0 and hasattr(glyph, "xMin")
                else None
            )
            glyph.recalcBounds(glyf)
            after = (
                (glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax)
                if hasattr(glyph, "xMin")
                else None
            )
            if before is not None and before != after:
                fixed += 1
        # the font-wide box in `head` is derived from the same outlines
        head = font["head"]
        boxes = [
            (glyf[n].xMin, glyf[n].yMin, glyf[n].xMax, glyf[n].yMax)
            for n in font.getGlyphOrder()
            if hasattr(glyf[n], "xMin")
        ]
        if boxes:
            head.xMin = min(b[0] for b in boxes)
            head.yMin = min(b[1] for b in boxes)
            head.xMax = max(b[2] for b in boxes)
            head.yMax = max(b[3] for b in boxes)

    # `gasp` version is not free to choose: it must be 1 exactly when a range
    # uses the version-1 smoothing bits, and 0 otherwise. The Google files
    # declare 0 while using those bits, which is what OTS rewrites. fontTools
    # derives the correct version on compile, so re-saving is the whole fix —
    # but strip undefined bits first, since OTS masks those too.
    if "gasp" in font:
        gasp = font["gasp"]
        cleaned = {ppem: (b & 0x0F) for ppem, b in gasp.gaspRange.items()}
        if cleaned != gasp.gaspRange:
            gasp.gaspRange = cleaned
        if gasp.version != _gasp_version(cleaned):
            gasp_bumped = True

    if fixed or gasp_bumped:
        font.flavor = "woff2"
        font.save(str(path))
    font.close()
    return fixed, gasp_bumped


def verify(path: Path) -> list[str]:
    """Re-open and confirm a browser would find nothing left to repair."""
    problems = []
    font = TTFont(str(path))
    if "glyf" in font:
        glyf = font["glyf"]
        for name in font.getGlyphOrder():
            glyph = glyf[name]
            if not hasattr(glyph, "xMin"):
                continue
            stored = (glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax)
            glyph.recalcBounds(glyf)
            if stored != (glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax):
                problems.append(f"{path.name}: {name} bbox still wrong")
    if "gasp" in font:
        gasp = font["gasp"]
        want = _gasp_version(gasp.gaspRange)
        if gasp.version != want:
            problems.append(
                f"{path.name}: gasp declares version {gasp.version}, flags require {want}")
        for ppem, behavior in gasp.gaspRange.items():
            if behavior & ~0x0F:
                problems.append(f"{path.name}: gasp range {ppem} has undefined bits")
    font.close()
    return problems


def main() -> int:
    files = sorted(FONT_DIR.glob("*.woff2"))
    if not files:
        print(f"no fonts in {FONT_DIR}", file=sys.stderr)
        return 1

    touched = glyphs = gasps = 0
    for path in files:
        try:
            fixed, bumped = fix(path)
        except Exception as err:                      # noqa: BLE001
            print(f"  !! {path.name}: {err}", file=sys.stderr)
            continue
        if fixed or bumped:
            touched += 1
            glyphs += fixed
            gasps += int(bumped)
            print(f"  {path.name}: {fixed} bboxes" + (", gasp->1" if bumped else ""))

    print(f"\n{len(files)} fonts, {touched} rewritten: "
          f"{glyphs} glyph boxes corrected, {gasps} gasp tables bumped")

    print("verifying…")
    problems = [p for path in files for p in verify(path)]
    if problems:
        for p in problems[:20]:
            print("  " + p, file=sys.stderr)
        print(f"{len(problems)} problems remain", file=sys.stderr)
        return 1
    print(f"clean: {len(files)} fonts have nothing left for the browser to repair")
    return 0


if __name__ == "__main__":
    sys.exit(main())
