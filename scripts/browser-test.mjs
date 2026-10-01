import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium, firefox } from 'playwright';
import { createServer } from 'node:http';
import { once } from 'node:events';

const upstreamResource = process.env.SKK_TEST_DICTIONARY_PATH
  ? (await readFile(process.env.SKK_TEST_DICTIONARY_PATH)).toString('base64') : null;
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
      await page.addInitScript(upstreamResource => {
        window.GM_getResourceURL = (name, blob) => {
          if (new URLSearchParams(location.search).get('resource') === 'full') return 'data:text/plain;base64,' + upstreamResource;
          if (name !== 'SKK_JISYO_L') throw new Error('Unknown resource');
          if (new URLSearchParams(location.search).get('resource') === 'missing') throw new Error('Missing resource');
          const bytes = Uint8Array.from(atob('pLikt6TnIC+8rb3xLwo='), c => c.charCodeAt(0));
          return new URLSearchParams(location.search).get('resource') === 'blob'
            ? URL.createObjectURL(new Blob([bytes])) : 'data:text/plain;base64,pLikt6TnIC+8rb3xLwo=';
        };
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
      }, upstreamResource);
      async function load(resource = 'data') {
        await page.goto(url + '?resource=' + resource); await page.addScriptTag({ content: script });
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
      const panel = page.locator('.panel');
      await page.locator('#text').focus();
      await panel.waitFor({ state: 'hidden' });
      await page.keyboard.press('Control+j');
      await panel.waitFor({ state: 'visible' });
      await panel.waitFor({ state: 'hidden' });
      await typeKeys('k');
      await panel.waitFor({ state: 'visible' });
      await typeKeys('a');
      await panel.waitFor({ state: 'hidden' });
      await typeKeys('Kanji ');
      await panel.waitFor({ state: 'visible' });
      const compact = await panel.boundingBox();
      assert.ok(compact.width <= 320 && compact.height <= 60, JSON.stringify(compact));
      await page.locator('#input').focus();
      await panel.waitFor({ state: 'hidden' });
      await reset(); await typeKeys('Kanji '); await page.keyboard.press('Enter');
      await panel.waitFor({ state: 'hidden' });
      await typeKeys('Kanji '); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'hidden' });
      console.log(`${name}: idle hiding, temporary mode badge, preedit, compact candidates, blur, confirmation and cancellation passed`);
      await reset(); await typeKeys('Jisho '); assert.match(await uiText(), /▼辞書/);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
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
        buffer: Buffer.from('てすと /試験;annotation/<img onerror=alert(1)>/' + '長い候補'.repeat(40) + '/四番/五番/六番/\nじしょ /字書/\n', 'utf8') });
      await page.waitForFunction(() => window.__skkUI.textContent.includes('2 見出しを保存'));
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await reset(); await typeKeys('Jisho '); assert.match(await uiText(), /▼字書/);
      await page.keyboard.press('Space'); assert.match(await uiText(), /▼辞書/); await page.keyboard.press('Enter');
      await reset(); await typeKeys('Tesuto '); assert.match(await uiText(), /▼試験/);
      await page.keyboard.press('Space'); assert.match(await uiText(), /<img onerror=alert\(1\)>/);
      assert.equal(await page.locator('img').count(), 0);
      await page.setViewportSize({ width: 280, height: 400 });
      await page.keyboard.press('Space');
      const small = await panel.boundingBox();
      assert.ok(small.width <= 264 && small.height <= 60 && small.x >= 8 && small.x + small.width <= 272, JSON.stringify(small));
      await page.keyboard.press('Space'); await page.keyboard.press('Space'); await page.keyboard.press('Space');
      assert.equal(await page.locator('.candidates .selected').textContent(), '6. 六番');
      await page.locator('.candidates .selected').click();
      assert.equal(await page.locator('#text').inputValue(), '六番');
      await panel.waitFor({ state: 'hidden' });
      await page.setViewportSize({ width: 1000, height: 850 });

      await reset(); await typeKeys('KaKu');
      await page.screenshot({ path: new URL(`../test-results/${name}.png`, import.meta.url).pathname });
      await load('blob'); await reset(); await typeKeys('Jisho '); assert.match(await uiText(), /▼辞書/);
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']());
      assert.match(await uiText(), /SKK-JISYO.L を使用中/);
      await load('missing'); await reset(); await typeKeys('Nihon '); assert.match(await uiText(), /▼日本/);
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']());
      assert.match(await uiText(), /内蔵小辞書を使用中/);
      if (upstreamResource) {
        await load('full'); await reset(); await typeKeys('Nihon '); assert.match(await uiText(), /▼日本/);
        await page.keyboard.press('Enter'); assert.equal(await page.locator('#text').inputValue(), '日本');
        await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']());
        assert.match(await uiText(), /SKK-JISYO.L を使用中/);
        const count = Number((await page.locator('.dialog p').first().textContent()).match(/現在 ([\d,]+) 見出し/)[1].replaceAll(',', ''));
        assert.ok(count > 100000, count);
        console.log(`${name}: real SKK-JISYO.L EUC-JP resource (${count} entries) passed`);
      }
      assert.deepEqual(errors, []);
      console.log(`${name}: input, candidate/okuri, selection, controlled input, rich-text undo, shadow DOM, excluded fields, cancellation, registration, persistence, dictionary import and text safety passed`);
    } finally { await browser.close(); }
  }
} finally { server.close(); }
