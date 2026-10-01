import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { createServer } from 'node:http';
import { once } from 'node:events';

const script = await readFile(new URL('../dist/skk-ime.user.js', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>SKK test fixture</title>
<style>body{font:18px system-ui;margin:35px}textarea,input,[contenteditable]{display:block;width:500px;margin:16px;padding:12px;border:1px solid #aaa}textarea{height:100px}[contenteditable]{white-space:pre-wrap}</style>
<h1>SKK Browser IME</h1><form><textarea id="text"></textarea><input id="input"><input id="password" type="password"><input id="readonly" readonly>
<div id="rich" contenteditable="true"><b>prefix:</b> </div><div data-skk-disable><textarea id="optout"></textarea></div>
<input id="controlled"><div id="shadowhost"></div><button type="submit">Send</button></form>
<script>
window.events=[];window.submits=0;
document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();window.submits++});
document.addEventListener('input',e=>window.events.push({id:e.target.id,data:e.data,value:e.target.value}));
const controlled=document.querySelector('#controlled');
let tracked='';Object.defineProperty(controlled,'value',{get(){return HTMLInputElement.prototype.__lookupGetter__('value').call(this)},set(v){tracked=v;HTMLInputElement.prototype.__lookupSetter__('value').call(this,v)}});
controlled.addEventListener('input',()=>window.controlledChanged=controlled.value!==tracked);
const shadow=document.querySelector('#shadowhost').attachShadow({mode:'open'});shadow.innerHTML='<textarea id="shadow"></textarea>';
</script></html>`;
const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(html); });
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const url = `http://127.0.0.1:${server.address().port}/`;
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });

try {
  for (const [name, type] of [['chromium', chromium], ['firefox', firefox]]) {
    if (process.env.SKK_TEST_BROWSERS && !process.env.SKK_TEST_BROWSERS.split(',').includes(name)) continue;
    const executablePath = process.env[`SKK_TEST_${name.toUpperCase()}_PATH`];
    const browser = await type.launch({ headless: true, timeout: 15000, ...(executablePath ? { executablePath } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
      page.setDefaultTimeout(8000);
      page.setDefaultNavigationTimeout(8000);
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(() => {
        window.__menus = {};
        window.GM_getValue = (key, fallback) => {
          const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v);
        };
        window.GM_setValue = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); };
        window.GM_registerMenuCommand = (label, fn) => { window.__menus[label] = fn; };
        // Capture the userscript UI for fixture testing; production uses closed shadow.
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function(options) {
          const root = attach.call(this, { ...options, mode: 'open' });
          if (options.mode === 'closed') window.__skkUI = root;
          return root;
        };
      });
      async function load() {
        await page.goto(url); await page.addScriptTag({ content: script });
        await page.waitForFunction(() => Object.keys(window.__menus).length === 3);
      }
      async function reset(selector = '#text', text = '') {
        await page.locator(selector).fill(text); await page.locator(selector).focus();
        await page.keyboard.press('Control+j');
      }
      async function typeKeys(text) { await page.keyboard.type(text); }
      async function uiText() { return page.evaluate(() => window.__skkUI.textContent); }
      await load();
      console.log(`${name}: loaded`);
      await reset(); await typeKeys("kon'nichiha"); assert.equal(await page.locator('#text').inputValue(), 'こんにちは');

      await reset(); await typeKeys('Kanji');
      assert.equal(await page.locator('#text').inputValue(), ''); assert.match(await uiText(), /▽かんじ/);
      await page.keyboard.press('Space'); assert.match(await uiText(), /▼漢字/);
      await page.keyboard.press('Space'); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '感じ');
      assert.equal(await page.evaluate(() => window.submits), 0);

      await reset(); await typeKeys('KaKu'); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '書く');
      await reset(); await typeKeys('Nihon '); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#text').inputValue(), '');

      await reset('#input', 'alpha OLD omega');
      await page.evaluate(() => document.querySelector('#input').setSelectionRange(6, 9));
      await typeKeys('Nihon '); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#input').inputValue(), 'alpha 日本 omega');

      await reset('#controlled'); await typeKeys('kana');
      assert.equal(await page.locator('#controlled').inputValue(), 'かな');
      assert.equal(await page.evaluate(() => window.controlledChanged), true);
      console.log(`${name}: text and controlled inputs passed`);

      await page.locator('#rich').focus(); await page.keyboard.press('End'); await page.keyboard.press('Control+j');
      await typeKeys('Nihon '); await page.keyboard.press('Enter');
      assert.match(await page.locator('#rich').textContent(), /prefix: 日本$/);
      assert.equal(await page.locator('#rich b').textContent(), 'prefix:');
      await page.keyboard.press('Control+z');
      assert.doesNotMatch(await page.locator('#rich').textContent(), /日本/);
      console.log(`${name}: contenteditable passed`);

      await reset(); await typeKeys('Nihon'); await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#text').inputValue(), 'にほん');
      await reset(); await typeKeys('Nihon'); await page.locator('#input').focus();
      assert.equal(await page.locator('#text').inputValue(), 'にほん');

      await reset('#password'); await typeKeys('kana'); assert.equal(await page.locator('#password').inputValue(), 'kana');
      await reset('#optout'); await typeKeys('kana'); assert.equal(await page.locator('#optout').inputValue(), 'kana');
      await page.locator('#readonly').focus(); await page.keyboard.press('Control+j'); await typeKeys('kana');
      assert.equal(await page.locator('#readonly').inputValue(), '');

      await reset('textarea#shadow'); await typeKeys('kana'); assert.equal(await page.locator('textarea#shadow').inputValue(), 'かな');
      console.log(`${name}: exclusions and shadow passed`);

      await reset(); await typeKeys('Nihon');
      await page.evaluate(() => { const t = document.querySelector('#text'); t.value = 'external'; t.setSelectionRange(8, 8); });
      await typeKeys('a'); assert.equal(await page.locator('#text').inputValue(), 'externalあ');

      await reset();
      await page.evaluate(() => document.querySelector('#text').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
      await typeKeys('kana');
      await page.evaluate(() => document.querySelector('#text').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
      assert.equal(await page.locator('#text').inputValue(), 'kana');

      await reset();
      await page.evaluate(() => document.querySelector('#text').addEventListener('beforeinput', e => { if (e.data === 'あ') e.preventDefault(); }));
      await typeKeys('a'); assert.equal(await page.locator('#text').inputValue(), '');

      // Missing candidate opens registration; cancel retains preedit; accept saves.
      await reset(); await typeKeys('Michi ');
      await page.getByRole('button', { name: '取消', exact: true }).click();
      assert.match(await uiText(), /▽みち/);
      await page.keyboard.press('Space');
      await page.getByRole('textbox', { name: '登録する単語' }).fill('道');
      await page.getByRole('button', { name: '登録', exact: true }).click();
      assert.equal(await page.locator('#text').inputValue(), '道');
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('skk.user.v1'))['みち'][0] === '道');

      await load(); await reset(); await typeKeys('Michi '); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '道');
      await reset(); await typeKeys('Kanji '); assert.match(await uiText(), /▼感じ/);
      await page.keyboard.press('Enter');

      // Import a local UTF-8 dictionary through the actual settings UI.
      await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']());
      await page.getByLabel('SKK 辞書ファイル').setInputFiles({ name: 'SKK-JISYO.test', mimeType: 'text/plain',
        buffer: Buffer.from('てすと /試験;annotation/<img onerror=alert(1)>/\n', 'utf8') });
      await page.waitForFunction(() => window.__skkUI.textContent.includes('1 見出しを保存'));
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await reset(); await typeKeys('Tesuto '); assert.match(await uiText(), /▼試験/);
      await page.keyboard.press('Space'); assert.match(await uiText(), /<img onerror=alert\(1\)>/);
      assert.equal(await page.locator('img').count(), 0);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

      await reset(); await typeKeys('KaKu');
      await page.screenshot({ path: new URL(`../test-results/${name}.png`, import.meta.url).pathname });
      assert.deepEqual(errors, []);
      console.log(`${name}: input, candidate/okuri, selection, controlled input, rich-text undo, shadow DOM, excluded fields, cancellation, registration, persistence, dictionary import and text safety passed`);
    } finally { await browser.close(); }
  }
} finally { server.close(); }
