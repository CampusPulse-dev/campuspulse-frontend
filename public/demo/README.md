# Demo photos

Images used by the demo seed data (`NEXT_PUBLIC_DEMO_MODE=true`). The paths are wired in
`src/lib/campus-data.ts`, `src/lib/attendee-data.ts` and `src/lib/organizer-data.ts`.
To use a real photo, save it here under the **same filename** (WebP, ideally 200 KB or less). No code change is needed.

`events/`, `stories/`, and `avatars/` contain consent-safe generated demo imagery. Replace
these with commissioned or permission-cleared photography before using real people or live
organization identities in production.

`orgs/` contains generated demo monograms. Use official, permission-cleared logos in production.

## events/ — event covers

| File                                      | Event                                           | Size            |
| ----------------------------------------- | ----------------------------------------------- | --------------- |
| `havana-night-sub-field.webp`             | Sigma Havana Night: neon crowd and stage lights | 1080×1350 (4:5) |
| `havana-official-afterparty-zik.webp`     | Zik Hall after-party lounge                     | 1080×1350 (4:5) |
| `lion-and-the-jewel-stage.webp`           | The Lion & The Jewel stage play                 | 1080×1350 (4:5) |
| `mellanby-vs-tedder-interhall-final.webp` | Inter-hall football final under floodlights     | 1600×900 (16:9) |
| `ui-ai-and-systems-summit.webp`           | Offline-First summit: speaker and audience      | 1600×900 (16:9) |

## stories/ — 9:16 vertical, 1080×1920

| File                      | Matches the story                                   |
| ------------------------- | --------------------------------------------------- |
| `havana-soundcheck.webp`  | Soundcheck and the Gate A scanner line at SUB Field |
| `stadium-goal.webp`       | Floodlit UI New Stadium during the match            |
| `theatre-backstage.webp`  | Backstage or curtain at the theatre                 |
| `gdg-speaker-lineup.webp` | Packed GDG workshop or speaker lineup               |

## orgs/ — 512×512 club monograms

`sigma-club-ui.webp`, `wole-soyinka-theatre.webp`, `ui-sports-council.webp`, `gdg-on-campus-ui.webp`,
`jci-ibadan-varsity.webp`, `ui-film-society.webp`. Regenerate them with
`node scripts/generate-demo-org-marks.mjs` after installing Playwright Chromium. The script uses
the vendored Inter font and category colors from the app's tokens.

## avatars/ — square face photos, 256×256 or larger

`adaeze-obi.webp`, `kunle-bello.webp`, `fisayo-ajayi.webp`, `tobi-adeyemi.webp` (the demo user) and
`bisola.webp` (the creator profile). Use photos of people who have agreed to it, or clearly fictional faces.
Never use real students' photos without consent (NDPA 2023).

## screens/ — captured demo product screens

The 780×1688 WebP files show the attendee feed, a confirmed demo pass, the organizer dashboard,
and the Manual Check-In tab. Start a local production build with `NEXT_PUBLIC_DEMO_MODE=true`
and run `node scripts/capture-demo-screens.mjs` with that variable set. The script uses
`http://localhost:3104` by default. Set `E2E_BASE_URL` to use another local port.
