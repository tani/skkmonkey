import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const profiles = [];
for (const editor of (await readdir(new URL('test/editors/', root), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
  if (editor === 'shared') continue;
  const paths = JSON.parse(await readFile(new URL(`test/editors/${editor}/profiles.json`, root), 'utf8'));
  for (const path of paths) profiles.push({ id: `${editor}/${path.split('/')[1]}`, path: `test/editors/${editor}/${path}` });
}
const args = process.argv.slice(2);
const selectedIds = args.filter(arg => !arg.startsWith('--'));
if (args.some(arg => arg.startsWith('--') && !['--list', '--install'].includes(arg))) throw new Error('Unknown matrix option');
for (const id of selectedIds) if (!profiles.some(profile => profile.id === id)) throw new Error(`Unknown editor profile: ${id}`);
const selected = selectedIds.length ? profiles.filter(profile => selectedIds.includes(profile.id)) : profiles;
if (args.includes('--list')) {
  for (const profile of selected) console.log(profile.id);
} else {
  const run = (command, args, options = {}) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: fileURLToPath(root), stdio: 'inherit', ...options });
    child.on('error', reject); child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  const results = [];
  for (const profile of selected) {
    console.log(`\nTesting ${profile.id}`);
    const started = Date.now();
    const dir = new URL('.', new URL(profile.path, root));
    let code = 0;
    if (args.includes('--install')) code = await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: fileURLToPath(dir) });
    if (!code) code = await run(process.execPath, ['scripts/editor-test.mjs'], { env: { ...process.env, SKK_EDITOR_PROFILE: profile.path } });
    const manifest = JSON.parse(await readFile(new URL('package.json', dir), 'utf8'));
    results.push({ profile: profile.id, browsers: process.env.SKK_TEST_BROWSERS ?? 'chromium,firefox',
      dependencies: manifest.dependencies, passed: code === 0, durationMs: Date.now() - started });
  }
  await mkdir(new URL('test-results/', root), { recursive: true });
  await writeFile(new URL('test-results/editor-matrix.json', root), JSON.stringify(results, null, 2) + '\n');
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.profile} (${result.durationMs} ms)`);
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
