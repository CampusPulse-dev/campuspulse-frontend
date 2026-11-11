Adds 60 live-stack browser executions across Chromium and Mobile WebKit, a real QR camera-video fixture, offline reload/replay journeys, fixed cold-mobile Lighthouse budgets, and the physical Android handoff checklist. Production builds block external Google font access and retain the checked-in licensed fonts.

Depends on frontend integration https://github.com/CampusPulse-dev/campuspulse-frontend/pull/26 and backend hardening https://github.com/CampusPulse-dev/campuspulse-backend/pull/36 (which depends on backend PR35). `release-backend.json` pins the exact backend source SHA. No database schema changes or production migration/deployment are included.

Validation before this PR: frontend 220/220 unit tests, lint and typecheck passed; backend real services passed 13 suites/52 tests and migration rehearsal. The new live and Lighthouse workflow results are appended once executed; defining these cases is not a claim that they passed. Local production build hit a Windows build-directory permission error and is being rerun with the font network blocked.

Release report: `docs/s6-release-report.md`; phone journey: `docs/android-acceptance.md`. Staging origins and Resend configuration are unavailable. Android physical acceptance is pending handoff. This PR remains draft until its automated gates pass; S6 remains open until all required evidence is returned.
