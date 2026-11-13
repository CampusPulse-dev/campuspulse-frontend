"""Rebuild the shipped font subsets in src/app/fonts/ from the official sources.

Usage: python scripts/subset-fonts.py <InterVariable.woff2> <GoodlyRegular.woff2> <JetBrainsMonoVariable.woff2>
Needs: pip install fonttools brotli
See src/app/fonts/PROVENANCE.md for why the subsets exist (the public pages' 2.5 s LCP budget).
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent.parent / "src" / "app" / "fonts"

LATIN = [
    (0x0000, 0x017F),  # Basic Latin, Latin-1, Latin Extended-A
    (0x2000, 0x206F),  # General punctuation
    (0x20A0, 0x20CF),  # Currency (₦)
    (0x2190, 0x21FF),  # Arrows
]
YORUBA = [
    (0x0300, 0x036F),  # Combining diacritics (tone marks)
    (0x1E00, 0x1EFF),  # Latin Extended Additional (ẹ ọ ṣ)
]
EXTRA = {0x2122, 0x2212, 0x2215, 0x2713, 0xFEFF, 0xFFFD}


def codepoints(ranges):
    points = set(EXTRA)
    for start, end in ranges:
        points.update(range(start, end + 1))
    return points


def build(source, name, ranges, features, pin=None):
    font = TTFont(source, lazy=False)
    options = subset.Options()
    options.layout_features = features
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints(ranges))
    subsetter.subset(font)
    if pin:
        # Subset first, then pin axes: instancing first trips over dropped glyphs.
        font = instancer.instantiateVariableFont(font, pin, updateFontNames=False)
    font.flavor = "woff2"
    out = OUT / name
    font.save(out)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


def main(inter, goodly, mono):
    text = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk"]
    build(inter, "InterLatin.woff2", LATIN + YORUBA,
          text + ["tnum", "case", "frac", "sups", "subs", "ordn", "numr", "dnom"], {"opsz": 14})
    # Display face: headings only, so no Yoruba marks (they fall back to Inter) and no
    # discretionary ligatures.
    build(goodly, "GoodlyLatin.woff2", LATIN, ["kern", "liga"])
    # Counters, timestamps and pass IDs: no programming ligatures (calt).
    build(mono, "JetBrainsMonoLatin.woff2", LATIN, ["ccmp", "locl", "mark"])


if __name__ == "__main__":
    main(*sys.argv[1:4])
