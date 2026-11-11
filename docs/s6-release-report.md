# S6 release evidence [S6-01]

Status: **in progress; not release approved**.

Dependencies: backend management PR35 and frontend integration PR26; backend hardening is based on PR35. `release-backend.json` pins the exact backend used for live testing; the contract pin remains in `backend-contract.json` until upstream main includes it.

The live workflow builds production Next.js with demo/development-header modes disabled, starts the real API with real JWT sessions and isolated PostgreSQL 16/Redis/MinIO, generates unique fixtures per browser/case, and executes L01–L30 in Chromium and Mobile WebKit (60 executions). Existing demo regression cases remain separate. Service workers stay enabled. Wallet and scanner journeys include full offline reloads; WebKit uses a socket-blocking proxy because its automation offline navigation can fail before service worker dispatch. Chromium uses a QR video fixture; WebKit denial preserves manual check-in. This does not replace Android acceptance.

Lighthouse runs three cold mobile samples per route (`/` and a seeded `/e/[slug]`) with fixed simulated 4G: 150ms RTT, 1638.4 Kbps and 4x CPU slowdown. Median LCP must be below 2500ms on both routes. Raw reports and runner specifications are retained. Every sample uses a fresh Chrome process and default storage reset. Timing-sensitive warm QR verification runs in its own step after builds, without competing test jobs inside that runner.

## Reproduction and evidence

- Backend: dedicated `scripts/test-stack.ts up`, `migrate`, `browser-fixtures`, build and `serve-live`.
- Frontend: `NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_DEV_AUTH=false NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 npm run build` with `NODE_OPTIONS=--require=./scripts/block-font-network.cjs`; this blocks Google font access. The checked-in licensed fonts are loaded through `next/font/local`.
- Camera: `node scripts/prepare-camera.mjs` (ffmpeg required).
- Browsers: `LIVE_E2E=true npx playwright test live.spec.ts`; reports/traces include synthetic data only. Do not upload generated credential fixture files or API logs.
- Performance: `node scripts/lighthouse-budget.mjs`; inspect `test-results/lighthouse/summary.json` and all six raw JSON reports. Use a fresh runner to reset server/test caches for reproducibility.
- Scanner crypto: `npx vitest run src/lib/door-live.test.ts --maxWorkers=1`; includes the warm <5ms verification assertion. Physical decode-to-feedback <500ms remains a required Android observation.

## Outstanding acceptance

Local Docker remains unavailable; local real-service pass is not claimed. Staging origins and Resend secure configuration are unavailable. Controlled-recipient OTP confirmation, cancellation/venue-change delivery, staging load/browser corroboration and physical Android results are pending. Backend `docs/s6-engineering-controls.md` records NDPA engineering evidence and unresolved security findings. Formal NDPA legal/organizational approval remains with the human owner.

PRs stay draft until their automated gates pass. S6 stays incomplete until automated, staging and physical evidence passes. No production migration, merge, deployment or promotion is performed by this work.
