import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
function json(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
mkdirSync('test-results', { recursive: true });
const browser = json('test-results/live-summary.json');
const lighthouse = json('test-results/lighthouse/summary.json');
const timing = json('test-results/qr-timing.json');
const runtime = json('../campuspulse-backend/test-results/runtime-evidence.json');
const status = (value) => value || 'not run';
const evidenceComplete =
  browser?.stats.expected >= 62 && browser.stats.unexpected === 0 && browser.stats.skipped === 0;
const rows =
  lighthouse?.routes
    .map(
      (route) =>
        `| ${route.path} | ${route.samplesLcpMs.map((value) => value.toFixed(1)).join(', ')} | ${route.medianLcpMs.toFixed(1)} | ${route.passed ? 'PASS' : 'FAIL'} |`,
    )
    .join('\n') ?? '| Not measured | — | — | pending |';
const lines = [
  '# S6 release evidence',
  '',
  '**Release approval: pending staging, controlled-recipient Resend delivery, physical Android acceptance and human NDPA approval.**',
  '',
  `Recorded: ${new Date().toISOString()}`,
  `Frontend tested commit: ${process.env.GITHUB_SHA ?? 'local'}`,
  `Backend tested commit: ${process.env.BACKEND_SHA ?? runtime?.backendCommit ?? 'unavailable'}`,
  `Workflow: ${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY ?? 'CampusPulse-dev/campuspulse-frontend'}/actions/runs/${process.env.GITHUB_RUN_ID ?? 'local'}`,
  '',
  '## Automated results',
  '',
  `- Production build with external font access blocked: ${status(process.env.BUILD_RESULT)}.`,
  `- Live Chromium/Mobile WebKit journeys: ${status(process.env.BROWSER_RESULT)}; ${browser?.stats.expected ?? 0} passed, ${browser?.stats.unexpected ?? 0} failed, ${browser?.stats.skipped ?? 0} skipped. Required: at least 62 passed, zero failed/skipped.`,
  `- Warm QR verification: ${status(process.env.QR_RESULT)}; ${timing ? timing.warmAverageMs.toFixed(4) + 'ms average across 20 warm verifications; budget <5ms' : 'raw measurement unavailable'}.`,
  '- Chromium decode-to-render feedback: <500ms is asserted in L22; its numeric attachment is retained in the Playwright report. Physical Android feedback is a separate pending gate.',
  `- Cold mobile Lighthouse: ${status(process.env.LIGHTHOUSE_RESULT)}. Three samples per route, 150ms RTT, 1638.4Kbps, 4x CPU slowdown; median LCP <2500ms.`,
  '',
  '| Route | Raw LCP samples (ms) | Median LCP (ms) | Gate |',
  '| --- | --- | --- | --- |',
  rows,
  '',
  'Runtime/machine specifications and immutable service image IDs: backend `test-results/runtime-evidence.json` in this artifact. Browser runtime flags disable demo and development-header authentication. Each Lighthouse sample uses fresh Chrome and default storage reset; a fresh runner and isolated Compose project reset service caches. Load fixtures are prepared before measurement.',
  '',
  'Backend migration, real-storage, E2E and k6 evidence: https://github.com/CampusPulse-dev/campuspulse-backend/pull/36. No production migration, merge or deployment is performed.',
  '',
  '## Handoff',
  '',
  '[Physical Android checklist](android-acceptance.md) — pending handoff.',
  '[NDPA engineering controls](backend-engineering-controls.md) — organizational/legal approval remains with the responsible human owner.',
  '',
];
copyFileSync('docs/android-acceptance.md', 'test-results/android-acceptance.md');
const controls = '../campuspulse-backend/docs/s6-engineering-controls.md';
if (existsSync(controls)) copyFileSync(controls, 'test-results/backend-engineering-controls.md');
writeFileSync('test-results/s6-release-report.md', lines.join('\n'));
// A green browser command without its required executions/raw evidence is not acceptance.
if (process.env.BROWSER_RESULT === 'success' && !evidenceComplete) process.exitCode = 1;
if (process.env.QR_RESULT === 'success' && !timing?.passed) process.exitCode = 1;
