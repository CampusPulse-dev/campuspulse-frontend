# CampusPulse V1 release execution ledger

Plan: approved CampusPulse V1 Integration and S6 Release Plan (11 November 2026).

## Deliverables

- [x] PR1 opened draft: backend management contracts + isolated infrastructure + migrations.
- [x] PR2 opened draft: frontend admin commit + live organizer/creator + local fonts.
- [x] PR3 opened draft: backend Resend + real storage/privacy + load/security evidence.
- [x] PR4 opened draft: frontend live browser suite + Lighthouse + Android handoff (verification pending).

## Constraints and rulings

- Existing checkouts are suitable feature branches; reuse them and preserve current admin edits.
- Existing backend PRs #27–34 form a stack; new backend integration targets `fix/S3-03-review-findings` rather than duplicating those diffs. Existing auth PR #14 is unrelated and remains untouched.
- Existing frontend PRs #24–25 form a stack; frontend integration targets `fix/S3-03-review-findings`.
- Local and staging synthetic-data validation only; no production migrations, deployment or merges.
- Full core event details are required for live draft save; no partial-draft schema migration.
- Physical Android acceptance remains pending the user's later handoff.
- Staging credentials/URLs and Resend sender/key must be resolved securely; do not print secrets.

## Evidence

- Initial branches: backend 34a810d, frontend 1ae28dc with uncommitted admin work.
- Remote PRs inspected and remotes fetched.
- Docker Desktop start requested; daemon initially unavailable.
- Docker crash identified: inaccessible AF_UNIX runtime socket. Backup move also failed. User explicitly instructed continuing without Docker; local database/storage E2E is blocked, use CI.
- Admin frontend committed as aef1b4f (37 tests + lint/typecheck passed).
- PR1 opened: https://github.com/CampusPulse-dev/campuspulse-backend/pull/35; branch tip initially 166e529. Unit suite 68/68, lint/typecheck/format/build/OpenAPI green locally. CI migration drift green; E2E startup failed because official MinIO Docker images were withdrawn.
- Ruling: build official MinIO source pinned at 7aac2a2c5b7c882e68c1ce017d8256be2feea27f rather than use a third-party image; costs CI build time. Added synthetic-fixture-only historical Gitleaks fingerprints, retaining full history scan. PR1 correction commit 7111348.
- User confirmed staging endpoints and Resend configuration are unavailable at present; staging delivery/performance gates stay pending.
- Frontend local-font production build succeeded; live adapter focused tests 3/3 and organizer components 36/36 after explicitly retaining demo-mode regression expectations.
- Ruling: make backend pre-push fail fast and serialise all tests. Existing hook could mask typecheck failure and spawned excessive test workers. No checks removed.

## Shared interfaces

## Final review and correction pass (12 November)

- Fresh final_release_review completed against backend2d04be1 and frontend e880d8c, read-only, no declined judgments. Critical: cross-tab profile edits erase queued scanner data. Important: ID-image async hide race; showtime WAT/end-time loss; ignored parent-link PATCH and series preservation; double publication save/upload; missing performer role; camera fixture deleted by test runner; inaccurate role/QR/header assertions; sign-out test missing scanner data; missing 500ms feedback measurement.
- Final: Ruling: regrade rejected-verification display and disabled live failure tracing as Important. A rejected applicant must see the terminal decision; live validation requires retained failure evidence. Both enter the correction pass.
- Final: minor (deferred): Lighthouse internally labels the required landing route `/` as `feed`; the measured route and threshold remain correct.
- Final: Ruling: the individual CodeQL optional-auth finding is a false positive after independent review. Required guard rejects null, JWTs undergo signature/live-user checks, and development auth is server-controlled and prohibited in production. Preserve the project-wide rule; any disposition must target only alert2. Cost if wrong: unauthorized access; retain auth/config and valid-email header denial coverage.
- Additional admin layout commit f9b4c6e928a0a2b56168ce6a76fb7e98f87d5c20 appeared while paused and is preserved. Managed worktree creation did not respond; workspace-local CLI worktree `.worktrees/frontend-s5` isolates PR2. PR2 now b52c480: all CI gates green, 220 unit tests and 50 demo browser cases passed.
- Backend2d04be13115cba777e13926071fcb9c4e24efc51 passed all automated gates including k6: sustained RSVP p95 15.399691ms; race10/40; unexpected HTTP errors0; dropped iterations0. Raw run43112607198 retained locally and on GitHub.
- Live CI stopped during fixture setup because tsx omits Nest dependency metadata. Local metadata assertion RED with tsx, GREEN after compiling fixture dependencies into ignored .test-dist with TypeScript. Correction329ab32 pushed.
- Parent-edit E2E reproduced RED against PostgreSQL at329ab32: 52 passed/1 failed of53; saved parent/linkType stayed null. Implementation now updates links in a serializable transaction, preserves existing approvals for unchanged relationships and rejects cycles. Full GREEN verification pending.
- Frontend regression RED: queued data erased, pending fetch/decode painted after hide, WAT/end times lost, series changed to after-party, performer role unchecked, duplicate publication path; seven failed. The focused suite then passed11/11 after corrections. Rejected status also reproduced RED and is corrected; whole-suite verification pending.
- PR4 https://github.com/CampusPulse-dev/campuspulse-frontend/pull/27 now defines62 live executions including a play-template regression. Camera input moves outside Playwright output cleanup; valid-email auth denial, exact QR errors, real cache/outbox deletion and <500ms decode-to-render measurement added. External staging/Resend and Android gates remain pending.

- PR1 tip 0e1fe93a3d710cbcaa957f6e27d0f1351d95c4a5: all 12 E2E suites / 49 tests passed against real services; migration deploy/status and drift passed. CodeQL flags optional-auth control flow; no broad suppression applied.
- PR2 https://github.com/CampusPulse-dev/campuspulse-frontend/pull/26: 220 unit tests, local production build with local fonts, types/lint passed. Demo CI identified ambiguous alert and sign-in navigation race; corrections committed b8a8b94.
- PR3 https://github.com/CampusPulse-dev/campuspulse-backend/pull/36: 76 unit tests locally; all 13 E2E suites / 52 tests plus initial-schema upgrade rehearsal passed in CI at 3a786b4004daadd10729696fe642e6afd20d65fe. Production build boundary and load-start entry point exposed by CI; fix in progress. Gitleaks new Render entry contains only a key and sync:false; exact historical fingerprint added (550b239).
- Ruling: leave PR1's optional-auth CodeQL finding open for explicit security review rather than blanket suppress/dismiss it. Cost: PR1 cannot satisfy every automated gate yet.
- Frontend live suite defines 60 distinct executions, isolated per browser/case. Android acceptance and staging/Resend delivery remain pending; user says access unavailable.

- PR1 generates management OpenAPI -> PR2 generated frontend API types.
- PR3 backend SHA + PR2 frontend SHA -> PR4 live stack CI and evidence.
- Local test services use separate project/ports/database/buckets; destructive test cleanup must be guarded.
