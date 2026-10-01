import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The combined fixture reuses each editor's current profile. No editor
// package is installed into the root dependency tree, even for type checking.
const base = new URL('../test/editors/', import.meta.url);
for (const entry of await readdir(base, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'shared') continue;
  const dir = new URL(`${entry.name}/profiles/current/`, base);
  await readFile(new URL('package-lock.json', dir));
  const code = await new Promise((resolve, reject) => {
    const child = spawn('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: fileURLToPath(dir),
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (code) process.exit(code);
}
