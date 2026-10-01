import { runScenarios } from '../test/editors/shared/scenarios.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite-plus';
import { chromium, firefox } from 'playwright';

const profilePath = process.env.SKK_EDITOR_PROFILE;
const profile = profilePath
  ? JSON.parse(await readFile(new URL(profilePath, new URL('../', import.meta.url)), 'utf8'))
  : null;
const profileDir = profilePath
  ? fileURLToPath(new URL('.', new URL(profilePath, new URL('../', import.meta.url))))
  : null;

const label = profile ? `${profile.editor}/${profile.name}` : 'baseline';
const ids = profile?.fixtures ?? ['monaco', 'monaco-native', 'cm5', 'cm6', 'pm', 'tiptap', 'quill'];
const dir = new URL(`../test-results/editors/${label}/`, import.meta.url);
await mkdir(dir, { recursive: true });
const entry = profile
  ? new URL('entry.ts', dir).pathname
  : new URL('../test/editors/fixture.ts', import.meta.url).pathname;
if (profile)
  await writeFile(
    entry,
    `import ${JSON.stringify(new URL(`../test/editors/${profile.editor}/fixture.ts`, import.meta.url).pathname)};\nimport { expose } from ${JSON.stringify(new URL('../test/editors/shared/fixture.ts', import.meta.url).pathname)};\nexpose();`,
  );
await build({
  configFile: false,
  define: { SKK_PROFILE_NATIVE: String(profile?.nativeEditContext ?? true) },
  plugins: [
    {
      name: 'editor-fixture-dependencies',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (
          !/^[^./]/.test(source) ||
          !importer ||
          importer.includes('/node_modules/') ||
          !importer.startsWith(fileURLToPath(new URL('../test/editors/', import.meta.url)))
        )
          return;
        // Resolve from the chosen locked tree, also bypassing Monaco's
        // version-dependent export maps for its worker entry. Transitive
        // dependencies stay inside this tree.
        const editor = importer
          .slice(fileURLToPath(new URL('../test/editors/', import.meta.url)).length)
          .split('/')[0];
        const dependencyDir =
          profileDir ??
          fileURLToPath(new URL(`../test/editors/${editor}/profiles/current/`, import.meta.url));
        const result = await this.resolve(
          resolve(dependencyDir, 'node_modules', source),
          importer,
          {
            skipSelf: true,
          },
        );
        if (!result || !result.id.startsWith(resolve(dependencyDir, 'node_modules') + '/'))
          throw new Error(`Dependency escaped isolated profile: ${source}`);
        return result;
      },
    },
  ],
  build: {
    outDir: fileURLToPath(dir),
    assetsDir: '',
    emptyOutDir: false,
    lib: {
      entry,
      name: 'EditorFixture',
      formats: ['es'],
      fileName: () => 'fixture.js',
      cssFileName: 'fixture',
    },
    target: ['chrome110', 'firefox115'],
    minify: false,
  },
  logLevel: 'warn',
});
const script = await readFile(new URL('../dist/skk-ime.user.js', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Real editor fixtures</title>
<link rel="stylesheet" href="/fixture.css"><style>body{font:16px system-ui;margin:20px}section{margin:18px 0}section>div{height:170px;border:1px solid #aaa}.CodeMirror{height:170px}.cm-editor{height:170px}.ProseMirror{min-height:140px;padding:8px}.ql-container{height:170px}.cm-content{font-size:16px}</style>
${ids.map((id) => `<section><h2>${id}</h2><div id="${id}"></div></section>`).join('')}
<script type="module" src="/fixture.js"></script></html>`;
const server = createServer(async (req, res) => {
  try {
    const name = req.url?.slice(1);
    if (!name) {
      res.setHeader('Content-Type', 'text/html;charset=utf-8');
      res.end(html);
      return;
    }
    if (!/^[\w.-]+$/.test(name)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader(
      'Content-Type',
      name.endsWith('.css')
        ? 'text/css'
        : name.endsWith('.js')
          ? 'text/javascript'
          : 'application/octet-stream',
    );
    res.end(await readFile(new URL(name, dir)));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/`;

try {
  /** @type {[string, import('playwright').BrowserType][]} */
  const browsers = [
    ['chromium', chromium],
    ['firefox', firefox],
  ];
  for (const [name, type] of browsers) {
    if (process.env.SKK_TEST_BROWSERS && !process.env.SKK_TEST_BROWSERS.split(',').includes(name))
      continue;
    const executablePath = process.env[`SKK_TEST_${name.toUpperCase()}_PATH`];
    const browser = await type.launch({
      headless: true,
      timeout: 15000,
      ...(executablePath ? { executablePath } : {}),
    });
    let page;
    try {
      page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.addInitScript(() => {
        const store = new Map();
        window.GM_getValue = (key, fallback) => store.get(key) ?? fallback;
        window.GM_setValue = (key, value) => {
          store.set(key, value);
        };
        window.GM_registerMenuCommand = () => {};
        window.GM_getResourceURL = () => 'data:text/plain;base64,pLikt6TnIC+8rb3xLwo=';
        // Preserve the original method; call it with each target element below.
        // oxlint-disable-next-line typescript/unbound-method
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (options) {
          const root = attach.call(this, { ...options, mode: 'open' });
          if (options.mode === 'closed') window.skkUI = root;
          return root;
        };
      });
      await page.goto(url);
      await page.waitForFunction(() => window.fixtureReady);
      await page.evaluate(() => {
        window.debugEvents = [];
        for (const type of ['keydown', 'paste', 'input', 'focusout'])
          document.addEventListener(
            type,
            (e) => {
              const target = e.target;
              window.debugEvents.push({
                type,
                key: e.key,
                data: e.clipboardData?.getData('text/plain') ?? e.data,
                value: target?.value,
                model: window.fixture['monaco-native']?.get() ?? window.fixture.monaco?.get(),
                target: target?.className,
                context: target?.editContext
                  ? [
                      target.editContext.text,
                      target.editContext.selectionStart,
                      target.editContext.selectionEnd,
                    ]
                  : undefined,
              });
            },
            true,
          );
        const context = document.querySelector('#monaco-native .native-edit-context')?.editContext;
        context?.addEventListener('textupdate', (e) =>
          window.debugEvents.push({
            type: 'textupdate',
            trusted: e.isTrusted,
            text: e.text,
            from: e.updateRangeStart,
            to: e.updateRangeEnd,
            selection: e.selectionStart,
            model: window.fixture['monaco-native'].get(),
            context: [context.text, context.selectionStart],
          }),
        );
      });
      await page.addScriptTag({ content: script });
      await page.waitForFunction(() => window.skkUI);
      await runScenarios(page, `${label}/${name}`, errors);
      await page.screenshot({ path: new URL(`${name}.png`, dir).pathname, fullPage: true });
      console.log(`${label}/${name}: all real editor integration checks passed`);
    } catch (error) {
      if (page)
        await page
          .screenshot({ path: new URL(`${name}-failure.png`, dir).pathname, fullPage: true })
          .catch(() => {});
      throw error;
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
