import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import QRCode from 'qrcode';
const data = JSON.parse(
  readFileSync(
    process.env.LIVE_FIXTURES ?? '../campuspulse-backend/test-results/browser-fixtures.json',
    'utf8',
  ),
);
mkdirSync('test-results', { recursive: true });
await QRCode.toFile('test-results/live-camera.png', data.chromium[21].qrToken, {
  width: 720,
  margin: 8,
  errorCorrectionLevel: 'M',
});
const result = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-loop',
    '1',
    '-i',
    resolve('test-results/live-camera.png'),
    '-t',
    '3',
    '-r',
    '10',
    '-pix_fmt',
    'yuv420p',
    resolve('test-results/live-camera.y4m'),
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
if (result.status !== 0) throw new Error('Camera fixture encoding failed; ffmpeg is required.');
