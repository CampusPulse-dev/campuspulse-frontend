# Vendored fonts

Downloaded 11 November 2026; retain the adjacent SIL Open Font License files.

| Asset                       | Official source                                                                         | SHA256 (source)                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| InterVariable.woff2         | https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/InterVariable.woff2 | 693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3 |
| JetBrainsMonoVariable.woff2 | https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwE.woff2     | 18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e |

JetBrains Mono provides normal Latin variable weights 100–800. `next/font/local` serves the fonts from this application; no font download happens during the build.

## InterLatin.woff2 (shipped instead of InterVariable.woff2)

The full Inter file is 352 KB, which alone held the public pages' largest paint past the 2.5 s budget on a throttled mobile connection. `InterLatin.woff2` (89 KB, SHA256 `27a5af8650d002221993c3108203476982612c5a6421229ff57e79bfd372b5e2`) is made from the source file above with `scripts/subset-inter.py` (fontTools + brotli):

- Code points: Basic Latin, Latin-1, Latin Extended-A, combining diacritics, Latin Extended Additional (Yoruba ẹ ọ ṣ and tone marks), general punctuation, currency (₦), arrows, ™ − ∕ ✓.
- Weight axis 100–900 stays variable; the optical-size axis is pinned at 14 (text size).
- OpenType features kept: kern, liga, calt, ccmp, locl, mark, mkmk, tnum, case, frac, sups, subs, ordn, numr, dnom.

Characters outside the subset (emoji, other scripts) fall back to the system font.
