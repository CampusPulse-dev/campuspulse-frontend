import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { cpus, totalmem, platform, release } from 'node:os';

const fixtures = JSON.parse(
  readFileSync(
    process.env.LIVE_FIXTURES ?? '../campuspulse-backend/test-results/browser-fixtures.json',
    'utf8',
  ),
);
const base = process.env.E2E_BASE_URL ?? 'http://localhost:3104';
mkdirSync('test-results/lighthouse', { recursive: true });
const evidence = {
  node: process.version,
  os: `${platform()} ${release()}`,
  cpu: cpus()[0]?.model,
  cores: cpus().length,
  memoryBytes: totalmem(),
  commit: process.env.GITHUB_SHA ?? 'local',
  backendCommit: process.env.BACKEND_SHA,
  cacheReset: 'Fresh Chrome process and default Lighthouse storage reset for every sample',
  throttling: { method: 'simulate', rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
  routes: [],
};
for (const [name, path] of [
  ['feed', '/'],
  ['event', `/e/${fixtures.chromium[0].eventSlug}`],
]) {
  const samples = [];
  for (let sample = 0; sample < 3; sample += 1) {
    const output = `test-results/lighthouse/${name}-${sample + 1}.json`;
    const result = spawnSync(
      'npx',
      [
        '--no-install',
        'lighthouse',
        `${base}${path}`,
        '--quiet',
        '--only-categories=performance',
        '--output=json',
        `--output-path=${output}`,
        '--chrome-flags=--headless --no-sandbox',
        '--form-factor=mobile',
        '--throttling-method=simulate',
        '--throttling.rttMs=150',
        '--throttling.throughputKbps=1638.4',
        '--throttling.cpuSlowdownMultiplier=4',
      ],
      { stdio: 'inherit', shell: process.platform === 'win32' },
    );
    if (result.error || result.status !== 0)
      throw new Error(`Lighthouse failed on ${name} sample ${sample + 1}`);
    const report = JSON.parse(readFileSync(output, 'utf8'));
    if (report.runtimeError) throw new Error(`Lighthouse runtime error on ${name}`);
    samples.push(report.audits['largest-contentful-paint'].numericValue);
  }
  const medianLcpMs = [...samples].sort((a, b) => a - b)[1];
  evidence.routes.push({ path, samplesLcpMs: samples, medianLcpMs, passed: medianLcpMs < 2500 });
}
writeFileSync('test-results/lighthouse/summary.json', JSON.stringify(evidence, null, 2));
process.stdout.write(JSON.stringify(evidence.routes) + '\n');
if (evidence.routes.some((route) => !route.passed)) process.exitCode = 1;
