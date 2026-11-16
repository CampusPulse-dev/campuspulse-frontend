"""Rebuild the shipped font subsets in src/app/fonts/ from the official sources.

Usage: python scripts/subset-fonts.py <InterVariable.woff2> <GoodlyRegular.woff2> <JetBrainsMonoVariable.woff2>
Needs: pip install fonttools brotli
See src/app/fonts/PROVENANCE.md for why the subsets exist (the public pages' 2.5 s LCP budget).

Every page downloads the *core* files. InterExt carries everything else (Yoruba
letters and tone marks, Latin Extended-A, wider punctuation, currency and arrows)
and is declared with a matching unicode-range in layout.tsx, so the browser only
fetches it when a page actually uses one of those characters.
"""

import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = Path(__file__).resolve().parent.parent / "src" / "app" / "fonts"

# Basic Latin, Latin-1, the punctuation/symbols the UI uses (incl. ₦ ← → − ✓).
CORE = (
    set(range(0x0020, 0x007F))
    | set(range(0x00A0, 0x0100))
    | {0x0131, 0x0152, 0x0153, 0x02C6, 0x02DA, 0x02DC}
    | set(range(0x2010, 0x2028))
    | set(range(0x2030, 0x203B))
    | {0x20A6, 0x20AC, 0x2122, 0x2190, 0x2192, 0x2212, 0x2713, 0xFEFF, 0xFFFD}
)
# Keep in sync with INTER_EXT_RANGE in src/app/layout.tsx.
EXT = (
    set(range(0x0100, 0x0180))  # Latin Extended-A
    | set(range(0x0300, 0x0370))  # Combining diacritics (Yoruba tone marks)
    | set(range(0x1E00, 0x1F00))  # Latin Extended Additional (ẹ ọ ṣ)
    | set(range(0x2000, 0x2070))  # General punctuation
    | set(range(0x20A0, 0x20D0))  # Currency
    | set(range(0x2190, 0x2200))  # Arrows
) - CORE

TEXT = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "case"]
# The CSS only uses weights 400-700 (normal, 500, 600, 700/bold).
WEIGHTS = {"opsz": 14, "wght": (400, 700)}


def build(source, name, codepoints, features, pin=None):
    font = TTFont(source, lazy=False)
    options = subset.Options()
    options.layout_features = features
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    if pin:
        # Subset first, then pin axes: instancing first trips over dropped glyphs.
        font = instancer.instantiateVariableFont(font, pin, updateFontNames=False)
    font.flavor = "woff2"
    out = OUT / name
    font.save(out)
    print(f"wrote {out} ({out.stat().st_size} bytes)")


def main(inter, goodly, mono):
    build(inter, "InterCore.woff2", CORE, TEXT, WEIGHTS)
    build(inter, "InterExt.woff2", EXT, TEXT, WEIGHTS)
    # Display face, headings only; anything outside the core falls back to Inter.
    build(goodly, "GoodlyCore.woff2", CORE, ["kern", "liga"])
    # Counters, timestamps and pass IDs: no programming ligatures (calt).
    build(mono, "JetBrainsMonoCore.woff2", CORE, ["ccmp", "locl", "mark"], {"wght": (400, 700)})


if __name__ == "__main__":
    main(*sys.argv[1:4])
