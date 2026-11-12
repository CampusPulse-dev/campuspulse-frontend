"""Rebuild src/app/fonts/InterLatin.woff2 from the official InterVariable.woff2.

Usage: python scripts/subset-inter.py path/to/InterVariable.woff2
Needs: pip install fonttools brotli
See src/app/fonts/PROVENANCE.md for why the subset exists.
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

RANGES = [
    (0x0000, 0x017F),  # Basic Latin, Latin-1, Latin Extended-A
    (0x0300, 0x036F),  # Combining diacritics (Yoruba tone marks)
    (0x1E00, 0x1EFF),  # Latin Extended Additional (ẹ ọ ṣ)
    (0x2000, 0x206F),  # General punctuation
    (0x20A0, 0x20CF),  # Currency (₦)
    (0x2190, 0x21FF),  # Arrows
]
EXTRA = {0x2122, 0x2212, 0x2215, 0x2713, 0xFEFF, 0xFFFD}
FEATURES = [
    "kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk",
    "tnum", "case", "frac", "sups", "subs", "ordn", "numr", "dnom",
]


def main(source: str) -> None:
    font = TTFont(source, lazy=False)
    options = subset.Options()
    options.layout_features = FEATURES
    subsetter = subset.Subsetter(options)
    codepoints = set(EXTRA)
    for start, end in RANGES:
        codepoints.update(range(start, end + 1))
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    # Subset first, then pin optical size: instancing first trips over dropped glyphs.
    font = instancer.instantiateVariableFont(font, {"opsz": 14}, updateFontNames=False)
    font.flavor = "woff2"
    out = Path(__file__).resolve().parent.parent / "src" / "app" / "fonts" / "InterLatin.woff2"
    font.save(out)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main(sys.argv[1])
