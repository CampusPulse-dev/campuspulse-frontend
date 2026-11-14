Completes the existing admin portal and replaces organizer/creator demo-only paths with real API operations: dashboard and drafts, editable events, publishing/cancellation, media/story uploads, team/door grants, CSV, statistics and ambassador attribution. Live event saves require complete core details; publishing retries reuse the saved event ID. Private queries are account-scoped.

Inter and JetBrains Mono are now vendored licensed variable WOFF2 files loaded with next/font/local. Production builds no longer fetch fonts. Contract checking is pinned to backend commit 42d4808 until the matching contracts reach main.

Depends on backend https://github.com/CampusPulse-dev/campuspulse-backend/pull/35 and frontend #25. Existing JWT session and live door-console commits are retained; admin work is its own commit aef1b4f.

Validation: 220/220 unit/component tests passed, frontend typecheck and lint passed, production build passed, and remote pinned-contract comparison passed. Full live database/browser acceptance is delivered in the following S6 PR. Staging endpoints/credentials are unavailable and physical Android testing remains pending the agreed handoff. No production deployment is included.
