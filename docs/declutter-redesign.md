# CampusPulse declutter and redesign

The redesign follows the supplied six-phase brief and `../docs/03-DESIGN-SYSTEM-AND-BRAND-GUIDELINES.md` in the workspace. The primary work is structural: fewer containers, one action area per task, clearer type roles, and reliable controls on a small phone.

## Design review and resulting changes

| Before                                                                   | After                                                                                             | Why                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Most sections and individual rows had the same bordered, rounded surface | Grouped sections, plain rows and hairline separators; contained event posters, passes and dialogs | Makes event imagery, the pass and primary actions easier to find |
| Search appeared in the feed twice, alongside shell search                | One shell search destination                                                                      | Removes competing entry points                                   |
| Header notifications duplicated the Alerts destination                   | Alerts stays in the navigation; unread is a small primary dot                                     | Keeps the mobile header focused                                  |
| Navigation used emoji and solid selected pills                           | Lucide line icons, primary text, subtle desktop selection                                         | Consistent icon weight and readable active labels                |
| Display, UI and metadata styles overlapped                               | Goodly display, Inter UI/body/metadata, Mono data                                                 | Makes type communicate purpose                                   |
| Category colours coloured whole chips                                    | Category colour is confined to an 8px dot                                                         | Event posters carry the visual variety                           |
| Event facts and spots repeated across cards and detail                   | One metadata line on a card; one details list; capacity in the commitment area                    | Reduces repetition                                               |
| Detail pages kept the mobile tab bar alongside the RSVP bar              | Pushed detail pages have one bottom action area                                                   | Reserves room for the decision to RSVP                           |
| Wallet repeated the event title outside and inside the pass              | The pass carries its own heading, stub, tear, QR and details                                      | Gives the offline pass a clear identity                          |
| Wizard steps and page headings repeated                                  | One page heading and one numbered step indicator                                                  | Makes progress easy to understand                                |
| Small buttons/tabs were 36–40px; errors were 12px                        | Shared controls are at least 44px; hints/errors use 14px                                          | Better touch and reading comfort                                 |
| Tabs exposed selected buttons without a connected panel                  | Roving tab stops, Arrow/Home/End keys and a labelled panel containing real content                | Supports keyboard users in the door flow                         |
| Stories always advanced after five seconds                               | Remaining-time pause/resume, hold pause, hidden-tab pause and reduced-motion pause                | Gives the viewer control over automatic playback                 |
| Multiple form styling systems                                            | Shared TextField, TextArea, SelectField and ToggleRow                                             | Consistent labels, descriptions, focus and input sizing          |
| Disabled controls faded their entire foreground                          | Opaque surface and readable muted text                                                            | Preserves legibility                                             |

## Phase 0 — Shared foundation

- Preserved the canonical brand, category and scanner colour values.
- Added separator, hero, semantic type, section spacing and motion tokens.
- Stored dark values once in private `--_dark-*` properties, referenced by explicit and system theme selectors.
- Added Icon, VerifiedMark, PulseLine, ListRow, Section, TextLink and BrandLockup primitives.
- Installed only `lucide-react`; CSS Modules and the existing motion package remain the UI foundation.
- Goodly is loaded locally from the supplied Goodly Regular (now shipped as the subset `src/app/fonts/GoodlyLatin.woff2`; see `src/app/fonts/PROVENANCE.md`), replacing the earlier handwritten font file. Inter remains the UI and body face. Official SVG lockups preserve the original logo lettering.
- Focus outlines no longer change the shape of focused controls.

## Phase 1 — Shells

- Attendee header: official lockup and search.
- Five attendee destinations: Home, Tickets, Friends, Alerts and Profile. Signed-out Home opens `/explore`.
- Desktop navigation has a neutral selected surface; mobile navigation uses icon and label emphasis with safe-area padding.
- Event details and individual passes hide the mobile tab bar. Back navigation on an individual pass returns to Tickets.
- A shared neutral demo banner states that sample passes are invalid for entry.
- Organizer content can use the canonical 72rem width. Events is a real navigation destination at `/organizer/[slug]/events`; New event belongs to page actions.
- Removed the repeated campus eyebrow from attendee page frames.

## Phase 2 — Attendee screens

- Feed: stories, one sticky date/category filter layer, a snap-scrolling recommended row and the remaining event list. Recommendations are excluded from the list. Search stays in the shell.
- Cards: 16:9 poster, category, save icon, title, time/venue, one compact template line, social proof and one RSVP/pass action. A real cover URL is used when available; missing covers receive a typographic brand fallback.
- Detail: poster/scrim hero, single organizer verification mark, When/Where/Entry/Dress rows, plain template sections, About, linked after-party and report action. Capacity appears in the commitment area.
- Pass: club/title stub, pulse tear and notch cutouts, labelled status, unchanged white QR quiet zone, name/date/venue rows and ticket ID. The wallet list uses linked rows.
- Friends, club search and notifications use rows instead of per-item cards. Verification and creator forms inherit the same unboxed sections and shared fields.
- Settings: profile form, account destinations, privacy/appearance, category notification switches and sign-out. Theme keeps the System default.

## Phase 3 — Auth and onboarding

- Focused centred forms with the supplied display face and shared input system.
- Neutral UI, with the school-domain hint in the email field.
- Sign in and Create account actions use direct labels.
- Mobile forms have no enclosing card surface; onboarding shows its segmented progress once, with Skip available.

## Phase 4 — Organizer and door

- Dashboard and EventHub show plain KPI strips and separated event rows.
- Published is neutral; verification and scan validity retain their semantic meanings.
- EventHub export lives with its header actions.
- Wizard has a sticky action area and a single step indicator.
- Team removal and story deletion are labelled icon actions with confirmation dialogs.
- QR Scanner and Manual Check-In stay equal peer tabs. Their content is inside the connected panel. Roster actions use compact 44px controls with attendee-specific accessible names.
- Existing scanner result colours, haptics, role restrictions and offline verification logic are retained.

## Phase 5 — Public introduction

- Signed-out `/` server-renders a landing page. The first-party `cp_signed_in=1` cookie selects the feed presentation for returning users. It is a non-PII hint, never an authorization credential. The auth provider installs or clears it with account state.
- `/explore` always offers public discovery.
- Landing sequence: minimal nav; campaign hero/pulse; available event cards; Find/RSVP/Show pass sequence; organizer proof; door result examples; native FAQ; grouped public footer.
- Event cards come from the existing feed. The heading says Tonight only when the supplied events fall in the six-hour window; otherwise it says Coming up. No events, statistics or testimonials are invented.
- The organizer composition explains real product steps without fake dashboard counts.
- The footer is shared with public event details. Trust links lead to the relevant FAQ disclosures.
- Public event content remains server-rendered and available without sign-in. API contracts and generated types are unchanged.
- Removed the shared attendee `loading.tsx` boundary: its streamed fallback left JavaScript-disabled visitors on Loading campus. Public route HTML now contains directly visible content; individual client data requests retain their own loading states.

## Inspiration mapping

The supplied brief names these references as pattern inspiration. This implementation does not import their code, assets or layouts, and does not claim a fresh audit of the gallery sites.

| Pattern in the brief                | Reference sites                       | CampusPulse use                                    |
| ----------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Declarative hero and a clear action | studio.motionsites.ai, modulify.ai    | Landing and auth hierarchy                         |
| Small navigation                    | motionin.design, modulify.ai          | Public navigation and attendee header              |
| Sort segment and one filter layer   | motionsites.ai, studio.motionsites.ai | Feed dates/categories                              |
| Image-first event presentation      | motionin.design, landdding.com        | Event posters and quiet card bodies                |
| Numbers without boxed KPI cards     | landdding.com, wonderlist.design      | Organizer strips                                   |
| Neutral chrome                      | motionin.design                       | Shells and separated rows                          |
| Poster continuity                   | motionin.design, 60fps.design         | Shared poster component and motion layout identity |
| Ticket reveal                       | 60fps.design                          | Existing RSVP bottom sheet and pass                |
| Native FAQ disclosure               | wonderlist.design                     | Landing questions                                  |
| Grouped typographic footer          | footer.design, motionsites.ai         | Shared public footer                               |

## Verification and preview

Repository gate:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
$env:NEXT_PUBLIC_DEMO_MODE='true'
npm run build
npm run test:e2e
```

`scripts/redesign-visual-check.mjs` uses Playwright against `E2E_BASE_URL` (default `http://localhost:3000`). It captures `/`, `/explore`, an event, a prepared pass, settings, organizer and door at 375px and 1280px in both themes, checks for overflow/sub-12px text/multiple page headings, completes sign-in and RSVP, and switches door tabs by keyboard. Outputs are under ignored `test-results/redesign/`.

Automated browser coverage includes public landing/event HTML with JavaScript disabled, wallet offline reload, organizer publishing, settings and door behavior. Physical-device testing and a measured cold 4G performance run remain release checks; desktop emulation does not establish either result.
