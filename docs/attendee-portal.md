# Attendee portal delivery — 1 November 2026

The Sprint 4 attendee screens are implemented locally. Live API integration remains gated on S1–S3 backend controllers. This is not a production-launch sign-off.

## Preview and tests

Live mode is the default. To review sample campus data, deliberately set NEXT_PUBLIC_DEMO_MODE=true before starting or building. A visible banner identifies demo screens; demo passes are not valid for entry. Demo sign-in accepts an email and password for simulation only; it does not contact an identity service. Student-email demo OTP is 123456. Demo ID-review buttons simulate decisions and never upload an image.

PowerShell:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE='true'
npm run dev
# Production browser acceptance:
npm run build
npm run test:e2e -- --workers=1
# Return to the default live build:
$env:NEXT_PUBLIC_DEMO_MODE='false'
npm run build
```

The browser suite starts its own server on port 3104; E2E_BASE_URL overrides this. An existing server is used only with E2E_REUSE_SERVER=true. CI builds the browser-test job explicitly in demo mode; its separate production build job stays live. Contract changes must land in the backend before frontend CI's remote codegen check can pass.

## Frontend status

| Ticket | Implementation                                                                                                                          | Live integration gate                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| S4-01  | UI primitives, responsive navigation, auth screens, persona setup, themes, PNG app icons and manifest                                   | JWT lifecycle, server-saved persona/preferences and role authorization       |
| S4-02  | Signed-out SSR event page and metadata, template blocks, organizer/creator pages, commitment controls, calendar and after-party prompts | Real RSVP/showtime eligibility, follows, reports and personalized event data |
| S4-03  | Paginated feed, six-hour mood filters, signed-in recommendations, accessible story media viewer and debounced search                    | Stories/search/For You endpoints and production ranking                      |
| S4-04A | Account-scoped IndexedDB wallet, exact QR payload persistence, QR SVG, pass states, timeline and offline shell                          | Server-issued passes, waitlist promotion and cancellation reconciliation     |
| S4-04B | Profile, persona edit, themes/privacy/mutes, OTP and direct private-ID submission UI                                                    | Verified identity and audited deletion enforced by backend                   |
| S4-04C | Friends, suggestions/requests/block, WhatsApp invitation, notification read states and opt-in push UI                                   | Server graph/privacy rules, live notifications and VAPID delivery            |

## API interfaces

New shapes are authored in backend src/contract/api/attendee.ts and registered in registry.ts. Event template fields and RSVP attribution/showtime/privacy inputs are additive contract extensions. openapi.json and frontend api-schema.d.ts are generated, not hand-edited. No database migration or backend controller implementation is included here.

| Capability          | Planned live requests                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session             | POST /auth/sign-in, /auth/sign-up, /auth/refresh, /auth/sign-out                                                                                               |
| Profile/preferences | PATCH /users/me; PUT /users/me/persona, /users/me/preferences                                                                                                  |
| Discovery           | GET /events/feed?category&cursor, /events/:slug, /stories, /search?q, /organizers/:slug, /organizers/:slug/events, /creators/:handle                           |
| Commitment          | POST /attendance/rsvps; POST/DELETE /attendance/interested/:eventId; POST/DELETE /organizers/:id/follow and /creators/:id/follow; POST /reports                |
| Wallet              | GET /attendance/me/tickets (RSVP plus public event metadata)                                                                                                   |
| Friends             | GET /friends; POST /friends/request and /friends/:id/respond                                                                                                   |
| Verification        | GET /verification/student/status; POST /verification/student/email-otp, /confirm-otp, /upload-url, /id-request; PUT presigned storage URL without auth cookies |
| Alerts              | GET /notifications; POST /notifications/:id/read and /notifications/push-subscribe                                                                             |

All API JSON requests use apiFetch. Failures stay visible in live mode; they never become fixture success. Server QR strings are persisted unchanged. Only confirmed passes render a QR. Local ticket data, app query data and wallet caches are cleared on account changes/sign-out. Student-ID file contents are never put in IndexedDB, localStorage, or the service worker cache.

## Verification results

- Frontend: 39 unit/component tests passed; lint, TypeScript and formatting checks passed.
- Browser acceptance: 8 tests passed across desktop Chromium and mobile WebKit, including full offline reloads, sign-out cache cleanup, public SSR, navigation, search, OTP simulation and themes.
- Backend contract support: TypeScript, lint, build and 12 existing tests passed. OpenAPI generation and frontend codegen were repeated with identical SHA-256 hashes.
- Changed backend contract files pass formatting checks. The backend-wide formatting check still reports pre-existing formatting/line-ending issues in untouched files; these are outside the attendee frontend changes.

## Browser verification notes

The offline acceptance test loads a pass online, caches the route/assets, disables network delivery, and fully reloads the page. Chromium uses context.setOffline(true). WebKit uses a local reverse proxy that drops real upstream sockets because Playwright's WebKit offline-emulation can reject navigation before service-worker dispatch: [upstream issue #42775](https://github.com/microsoft/playwright/issues/42775). It does not mock a QR or return a canned wallet page.

Device Safari validation, cold-load performance budgets, server-authorized permissions, signed-pass authenticity, verification deletion and production persistence remain launch gates. Next frontend work is S5-01 organizer tools, then S5-02 door console and S5-03 admin.
