import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const contract = JSON.parse(
  readFileSync(new URL('../backend-contract.json', import.meta.url), 'utf8'),
);
const source = `https://raw.githubusercontent.com/${contract.repository}/${contract.ref}/openapi.json`;
const directory = mkdtempSync(join(tmpdir(), 'campuspulse-contract-'));
try {
  const output = join(directory, 'api-schema.d.ts');
  const result = spawnSync(
    process.execPath,
    [resolve('node_modules/openapi-typescript/bin/cli.js'), source, '-o', output],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else if (
    readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !==
    readFileSync('src/lib/api-schema.d.ts', 'utf8').replaceAll('\r\n', '\n')
  ) {
    process.stderr.write(
      `API types differ from backend ${contract.ref}. Regenerate from that exact commit.\n`,
    );
    process.exitCode = 1;
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
