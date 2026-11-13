# Vendored fonts

Retain the adjacent SIL Open Font License files.

## Sources

| Source file                 | Origin                                                                                                     | SHA256                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| InterVariable.woff2         | https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/InterVariable.woff2 (11 November 2026) | 693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3 |
| JetBrainsMonoVariable.woff2 | https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwE.woff2 (11 November 2026)     | 18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e |
| GoodlyRegular.woff2         | CampusPulse brand identity kit; in this repository's history at `dd2ff8b`                                  | 95342da6190ed691a3d6e9ce7648176d9cb9372a025ce8720eb8c0eeb7cb7d13 |

## Shipped subsets

The full files total 430 KB. On a throttled mobile connection, that alone held the public pages' largest paint past the PRD's 2.5 s budget. `next/font/local` serves these subsets instead, built from the sources above with `scripts/subset-fonts.py` (fontTools + brotli):

| Shipped file             | Size  | SHA256                                                           |
| ------------------------ | ----- | ---------------------------------------------------------------- |
| InterLatin.woff2         | 88 KB | 0cfbed2f386534eb386aac709c400ddd572045fc3754f2ab9911e933c4b84701 |
| GoodlyLatin.woff2        | 26 KB | 4f580c7899d5707b5b2bfdf56485d318e8d5a19df7783a64951af36e4b33cef5 |
| JetBrainsMonoLatin.woff2 | 20 KB | 4954c1f2c583b3cdd4df474de749609f62279107b058778e092e49df47c4078f |

All three cover Basic Latin, Latin-1, Latin Extended-A, general punctuation, currency (₦), arrows, and ™ − ∕ ✓.

- **Inter** (body and UI) also keeps the combining diacritics and Latin Extended Additional for Yoruba (ẹ ọ ṣ, tone marks). Weight stays variable (100–900); optical size is pinned at 14.
- **Goodly** (headings) keeps `kern` and `liga`. Yoruba letters in a heading fall back to Inter.
- **JetBrains Mono** (counters, timestamps, pass IDs) drops the programming ligatures (`calt`). Weight stays variable (100–800).

Characters outside a subset, such as emoji or other scripts, fall back to the next font in the stack.
