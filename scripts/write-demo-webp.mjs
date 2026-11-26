import { open } from 'node:fs/promises';

export async function writeDemoWebp(output, bytes) {
  // Windows worktrees may reject opening an existing asset with the truncate flag.
  const file = await open(output, 'r+').catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return open(output, 'wx');
  });
  try {
    await file.writeFile(bytes);
    await file.truncate(bytes.length);
  } finally {
    await file.close();
  }
}
