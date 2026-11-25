# Vendored fonts

Retain the adjacent SIL Open Font License files.

## Sources

| Source file                 | Origin                                                                                                     | SHA256                                                           |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| InterVariable.woff2         | https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/InterVariable.woff2 (11 November 2026) | 693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3 |
| JetBrainsMonoVariable.woff2 | https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbV2o-flEEny0FZhsfKu5WU4xD7OwE.woff2 (11 November 2026)     | 18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e |
| GoodlyRegular.woff2         | CampusPulse brand identity kit; in this repository's history at `dd2ff8b`                                  | 95342da6190ed691a3d6e9ce7648176d9cb9372a025ce8720eb8c0eeb7cb7d13 |

## Shipped subsets

The full files total 430 KB. On a throttled mobile connection, that alone held the public pages' largest paint well past the PRD's 2.5 s budget. `next/font/local` serves these subsets instead, built from the sources above by `scripts/subset-fonts.py` (fontTools + brotli).

Every page downloads only the three **core** files: 58 KB in total.

| Shipped file            | Size  | Loaded                      | SHA256                                                           |
| ----------------------- | ----- | --------------------------- | ---------------------------------------------------------------- |
| InterCore.woff2         | 26 KB | every page (preloaded)      | 2f914f8758ccf7a7915904e79e5b6a40719f76a30c9da12e153489903b96ca09 |
| GoodlyCore.woff2        | 18 KB | every page (preloaded)      | b76c991776604b0f65228bd58886d1ccaa68673d1cc671858ee93bb88a27a845 |
| JetBrainsMonoCore.woff2 | 14 KB | when mono text renders      | 2ddd9d2b6d3e38e7acf0dc2c57615ac5b7c7e109f3da8ef11a377fde6bf1a0e9 |
| InterExt.woff2          | 33 KB | only when the page needs it | bbade0c55038f4a07713beb35777f164fc5ca1e9d342730915eeb65599802853 |

- **Core** covers Basic Latin, Latin-1 and the symbols the UI uses: dashes, quotes, ellipsis, ₦, €, ™, ← →, −, ✓.
- **InterExt** covers everything else the old subset had:
  - Yoruba letters and tone marks (ẹ ọ ṣ, combining accents).
  - Latin Extended-A.
  - Wider punctuation, currency and arrows.

  Its `@font-face` carries a `unicode-range` generated from the file, so a page downloads it only when it uses one of those characters. It comes first in the body font stack and claims only those characters.

- **Weights:** Inter and JetBrains Mono keep a variable weight axis, trimmed to 400–700 because the CSS uses only normal, 500, 600 and 700. Inter's optical size is pinned at 14.
- **Features:** Goodly keeps `kern` and `liga`. JetBrains Mono drops its programming ligatures (`calt`).

Characters outside every subset, such as emoji or other scripts, fall back to the system font.
