import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';
import { chromium, firefox } from 'playwright';

const dir = new URL('../test-results/editors/', import.meta.url);
await mkdir(dir, { recursive: true });
await build({ entryPoints: [new URL('../test/editors/fixture.ts', import.meta.url).pathname],
  outfile: new URL('fixture.js', dir).pathname, bundle: true, platform: 'browser', format: 'iife',
  loader: { '.ttf': 'file' }, target: ['chrome110', 'firefox115'], logLevel: 'warning' });
const script = await readFile(new URL('../dist/skk-ime.user.js', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Real editor fixtures</title>
<link rel="stylesheet" href="/fixture.css"><style>body{font:16px system-ui;margin:20px}section{margin:18px 0}section>div{height:170px;border:1px solid #aaa}.CodeMirror{height:170px}.cm-editor{height:170px}.ProseMirror{min-height:140px;padding:8px}.ql-container{height:170px}.cm-content{font-size:16px}</style>
${['monaco','monaco-native','cm5','cm6','pm','tiptap','quill'].map(id => `<section><h2>${id}</h2><div id="${id}"></div></section>`).join('')}
<script src="/fixture.js"></script></html>`;
const server = createServer(async (req, res) => {
  try {
    const name = req.url?.slice(1);
    if (!name) { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(html); return; }
    if (!/^[\w.-]+$/.test(name)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    res.end(await readFile(new URL(name, dir)));
  } catch { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/`;

try {
  for (const [name, type] of [['chromium', chromium], ['firefox', firefox]]) {
    if (process.env.SKK_TEST_BROWSERS && !process.env.SKK_TEST_BROWSERS.split(',').includes(name)) continue;
    const executablePath = process.env[`SKK_TEST_${name.toUpperCase()}_PATH`];
    const browser = await type.launch({ headless: true, timeout: 15000, ...(executablePath ? { executablePath } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1000, height: 900 } }); page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(() => {
        const store = new Map();
        window.GM_getValue = (key, fallback) => store.get(key) ?? fallback;
        window.GM_setValue = (key, value) => { store.set(key, value); };
        window.GM_registerMenuCommand = () => {};
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function(options) {
          const root = attach.call(this, { ...options, mode: 'open' });
          if (options.mode === 'closed') window.skkUI = root;
          return root;
        };
      });
      await page.goto(url); await page.waitForFunction(() => window.fixtureReady);
      await page.evaluate(() => {
        window.debugEvents = [];
        for (const type of ['keydown', 'paste', 'input', 'focusout']) document.addEventListener(type, e => {
          const target = e.target;
          window.debugEvents.push({ type, key: e.key, data: e.clipboardData?.getData('text/plain') ?? e.data,
            value: target?.value, model: window.fixture['monaco-native']?.get() ?? window.fixture.monaco.get(), target: target?.className,
            context: target?.editContext ? [target.editContext.text, target.editContext.selectionStart, target.editContext.selectionEnd] : undefined });
        }, true);
        const context = document.querySelector('#monaco-native .native-edit-context')?.editContext;
        context?.addEventListener('textupdate', e => window.debugEvents.push({ type: 'textupdate', trusted: e.isTrusted,
          text: e.text, from: e.updateRangeStart, to: e.updateRangeEnd, selection: e.selectionStart, model: window.fixture['monaco-native'].get(), context: [context.text, context.selectionStart] }));
      });
      await page.addScriptTag({ content: script }); await page.waitForFunction(() => window.skkUI);
      const names = await page.evaluate(() => Object.keys(window.fixture));
      async function model(id) { return page.evaluate(id => window.fixture[id].get(), id); }
      async function expectModel(id, text) {
        try { await page.waitForFunction(([id, text]) => window.fixture[id].get() === text, [id, text]); }
        catch (error) {
          console.log('DEBUG', await page.evaluate(id => ({ model: window.fixture[id].get(), active: document.activeElement?.outerHTML,
            preedit: window.skkUI?.querySelector('.preedit')?.textContent, note: window.skkUI?.querySelector('.note')?.textContent,
            events: window.debugEvents.slice(-15) }), id));
          throw error;
        }
      }
      async function reset(id, text = '') {
        await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
        await page.evaluate(([id, text]) => { window.fixture[id].set(text); window.fixture[id].focus(); }, [id, text]);
        await page.keyboard.press('Control+j');
        // Allow the editor to update its hidden input / native EditContext.
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
      for (const id of names) {
        console.log(`${name}/${id}: starting`);
        await reset(id); await page.keyboard.type("kon'nichiha"); await expectModel(id, 'こんにちは');
        if (id === 'monaco-native') {
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await page.evaluate(() => document.activeElement.editContext.text), 'こんにちは');
        }
        await reset(id); await page.keyboard.type('lABC'); await expectModel(id, 'ABC');
        await page.keyboard.press('Control+j'); await page.keyboard.type('kana'); await expectModel(id, 'ABCかな');
        await reset(id); await page.keyboard.type('Kanji'); assert.equal(await model(id), '');
        await page.keyboard.press('Space');
        const first = await page.evaluate(() => window.skkUI.querySelector('.preedit').textContent.slice(1));
        await page.keyboard.press('Space'); await page.keyboard.press('x'); await page.keyboard.press('Enter'); await expectModel(id, first);
        await reset(id); await page.keyboard.type('KaKu'); await page.keyboard.press('Enter'); await expectModel(id, '書く');
        await reset(id, 'alpha OLD omega');
        await page.evaluate(id => window.fixture[id].select(6, 9), id);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.keyboard.type('Nihon '); await page.keyboard.press('Enter'); await expectModel(id, 'alpha 日本 omega');
        await page.keyboard.press('Control+z'); await expectModel(id, 'alpha OLD omega');
        await page.keyboard.press(id === 'quill' ? 'Control+Shift+z' : 'Control+y'); await expectModel(id, 'alpha 日本 omega');
        await reset(id); await page.keyboard.type('Nihon '); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await expectModel(id, '');
        await reset(id); await page.keyboard.type('Nihon ');
        await page.getByRole('button', { name: /^1\. 日本$/ }).click(); await expectModel(id, '日本');
        await reset(id, 'prefix:'); await page.keyboard.type('/fixture-' + id + ' ');
        await page.getByRole('textbox', { name: '登録する単語' }).fill('登録');
        await page.getByRole('button', { name: '登録', exact: true }).click(); await expectModel(id, 'prefix:登録');
        await reset(id); await page.keyboard.type('kana'); await page.keyboard.press('ArrowLeft'); await page.keyboard.type('a'); await expectModel(id, 'かあな');
        await reset(id); await page.keyboard.type('a'); await page.keyboard.press('Backspace'); await expectModel(id, '');
        await reset(id); await page.keyboard.type('Nihon');
        await page.evaluate(id => window.fixture[id].set('external'), id);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.keyboard.type('a'); await expectModel(id, 'externalあ');
        await reset(id, 'locked'); await page.evaluate(id => window.fixture[id].readonly(true), id);
        await page.keyboard.type('kana'); assert.equal(await model(id), 'locked');
        await page.evaluate(id => window.fixture[id].readonly(false), id);
        console.log(`${name}/${id}: kana, candidates, okuri, selected replacement, undo/redo, cancel, candidate click, cursor, delete, stale edit, read-only passed`);
      }
      // Rich-text marks are preserved in the model, not merely in rendered DOM.
      await reset('pm'); await page.evaluate(() => { window.fixture.pm.marked(); window.fixture.pm.focus(); });
      await page.keyboard.type('Nihon '); await page.keyboard.press('Enter'); await expectModel('pm', 'bold日本');
      assert.match(await page.evaluate(() => window.fixture.pm.html()), /<strong>bold日本<\/strong>/);
      for (const id of ['monaco', ...(names.includes('monaco-native') ? ['monaco-native'] : []), 'cm5', 'cm6']) {
        await reset(id, 'x\ny'); await page.evaluate(id => window.fixture[id].multi(), id);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.keyboard.type('Nihon '); await page.keyboard.press('Enter'); await expectModel(id, '日本x\n日本y');
      }
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`${name}.png`, dir).pathname, fullPage: true });
      console.log(`${name}: all real editor integration checks passed`);
    } finally { await browser.close(); }
  }
} finally { server.close(); }
