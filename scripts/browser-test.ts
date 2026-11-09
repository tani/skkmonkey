import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium, firefox, type BrowserType } from 'playwright';
import { createServer } from 'node:http';
import { once } from 'node:events';

declare global {
  interface Window {
    GM_getValue: typeof GM_getValue;
    GM_setValue: typeof GM_setValue;
    GM_registerMenuCommand: typeof GM_registerMenuCommand;
    GM_getResourceURL: typeof GM_getResourceURL;
    __menus: Record<string, () => unknown>;
    __skkUI: ShadowRoot;
    submits: number;
    controlledChanged: boolean;
    slateWrites: string[];
    slateEnters: number;
    applySlate: () => void;
    moveSlateCaret: () => void;
  }
}

const upstreamResource = process.env.SKK_TEST_DICTIONARY_PATH
  ? (await readFile(process.env.SKK_TEST_DICTIONARY_PATH)).toString('base64')
  : null;
const script = await readFile(new URL('../dist/skk-ime.user.js', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>SKK test fixture</title>
<style>body{font:18px system-ui;margin:35px}textarea,input,[contenteditable]{display:block;width:500px;margin:16px;padding:12px;border:1px solid #aaa}textarea{height:100px}[contenteditable]{white-space:pre-wrap}</style>
<h1>SKK Browser IME</h1><form><textarea id="text"></textarea><input id="input"><input id="password" type="password"><input id="readonly" readonly>
<div id="rich" contenteditable="true"><b>prefix:</b> </div><div data-skk-disable><textarea id="optout"></textarea></div>
<div id="slate" data-slate-editor="true" contenteditable="true" role="textbox" aria-label="Message #test"></div>
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
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html;charset=utf-8');
  res.end(html);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address !== 'string');
const url = `http://127.0.0.1:${address.port}/`;
await mkdir(new URL('../test-results/', import.meta.url), { recursive: true });

try {
  const browsers: [string, BrowserType][] = [
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
    try {
      const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
      page.setDefaultTimeout(8000);
      page.setDefaultNavigationTimeout(8000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript((upstreamResource) => {
        window.GM_getResourceURL = (name) => {
          if (new URLSearchParams(location.search).get('resource') === 'full')
            return 'data:text/plain;base64,' + upstreamResource;
          if (name !== 'SKK_JISYO_L') throw new Error('Unknown resource');
          if (new URLSearchParams(location.search).get('resource') === 'missing')
            throw new Error('Missing resource');
          const bytes = Uint8Array.from(atob('pLikt6TnIC+8rb3xLwo='), (c) => c.charCodeAt(0));
          return new URLSearchParams(location.search).get('resource') === 'blob'
            ? URL.createObjectURL(new Blob([bytes]))
            : 'data:text/plain;base64,pLikt6TnIC+8rb3xLwo=';
        };
        window.__menus = {};
        window.GM_getValue = (key, fallback) => {
          const v = localStorage.getItem(key);
          return v === null ? fallback : (JSON.parse(v) as typeof fallback);
        };
        window.GM_setValue = (key, value) => {
          localStorage.setItem(key, JSON.stringify(value));
        };
        window.GM_registerMenuCommand = (label, fn) => {
          window.__menus[label] = fn;
        };
        // Capture the userscript UI for fixture testing; production uses closed shadow.
        // Preserve the original method; call it with each target element below.
        // oxlint-disable-next-line typescript/unbound-method
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (options) {
          const root = attach.call(this, { ...options, mode: 'open' });
          if (options.mode === 'closed') window.__skkUI = root;
          return root;
        };
      }, upstreamResource);
      async function load(resource = 'data') {
        await page.goto(url + '?resource=' + resource);
        await page.addScriptTag({ content: script });
        await page.waitForFunction(() => Object.keys(window.__menus).length === 3);
      }
      async function reset(selector = '#text', text = '') {
        await page.locator(selector).fill(text);
        await page.locator(selector).focus();
        await page.keyboard.press('Control+j');
      }
      async function typeKeys(text: string) {
        await page.keyboard.type(text);
      }
      async function uiText() {
        return page.evaluate(() => window.__skkUI.textContent ?? '');
      }
      await load();
      console.log(`${name}: loaded`);
      const panel = page.locator('.panel');
      const inline = page.locator('.inline-preedit');
      await page.locator('#text').focus();
      await panel.waitFor({ state: 'hidden' });
      await page.keyboard.press('Control+j');
      assert.equal(await panel.isVisible(), false);
      await typeKeys('q');
      await panel.waitFor({ state: 'visible' });
      await panel.waitFor({ state: 'hidden' });
      await typeKeys('k');
      await panel.waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'hidden' });
      await typeKeys('q');
      assert.equal(await panel.isVisible(), false);
      await typeKeys('k');
      await inline.waitFor({ state: 'visible' });
      assert.equal(await inline.textContent(), 'k');
      assert.equal(await panel.isVisible(), false);
      assert.equal(await page.locator('#text').inputValue(), '');
      const firstLine = await inline.boundingBox();
      assert.ok(firstLine);
      await typeKeys('a');
      assert.equal(await inline.isVisible(), false);
      assert.equal(await page.locator('#text').inputValue(), 'か');

      await reset('#text', 'first\nsecond');
      await page.keyboard.press('End');
      await typeKeys('k');
      await inline.waitFor({ state: 'visible' });
      const secondLine = await inline.boundingBox();
      const fieldBox = await page.locator('#text').boundingBox();
      assert.ok(secondLine && fieldBox);
      assert.ok(secondLine.x > firstLine.x && secondLine.y > firstLine.y);
      assert.ok(secondLine.y + secondLine.height <= fieldBox.y + fieldBox.height);
      await page.keyboard.press('Backspace');
      assert.equal(await inline.isVisible(), false);
      assert.equal(await page.locator('#text').inputValue(), 'first\nsecond');

      await reset('#input', 'prefix');
      await page.keyboard.press('End');
      await typeKeys('k');
      await inline.waitFor({ state: 'visible' });
      const inputBox = await page.locator('#input').boundingBox();
      const inputPreview = await inline.boundingBox();
      assert.ok(inputBox && inputPreview);
      assert.ok(inputPreview.x > inputBox.x && inputPreview.x < inputBox.x + inputBox.width);
      assert.ok(inputPreview.y >= inputBox.y && inputPreview.y < inputBox.y + inputBox.height);
      await typeKeys('a');
      assert.equal(await page.locator('#input').inputValue(), 'prefixか');
      assert.equal(await inline.isVisible(), false);

      await reset('#rich', 'prefix');
      await page.keyboard.press('End');
      await typeKeys('k');
      await inline.waitFor({ state: 'visible' });
      const richPreview = await inline.boundingBox();
      const richCaret = await page.evaluate(() => {
        const rect = document.getSelection()!.getRangeAt(0).getBoundingClientRect();
        return { x: rect.x, y: rect.y };
      });
      assert.ok(richPreview);
      assert.ok(
        Math.abs(richPreview.x - richCaret.x) < 1 && Math.abs(richPreview.y - richCaret.y) < 1,
      );
      assert.equal(await page.locator('#rich').textContent(), 'prefix');
      await page.keyboard.press('Escape');
      assert.equal(await inline.isVisible(), false);
      // Restore the rich-text fixture used by the later undo/markup checks.
      await page.evaluate(() => {
        document.querySelector('#rich')!.innerHTML = '<b>prefix:</b> ';
      });
      await reset();
      const burst = await page.evaluate(() => {
        const field = document.querySelector<HTMLTextAreaElement>('#text')!;
        field.value = '';
        let measurements = 0;
        const measure = field.getBoundingClientRect.bind(field);
        field.getBoundingClientRect = () => {
          measurements++;
          return measure();
        };
        const values = [];
        try {
          for (const key of 'kanashikatta') {
            field.dispatchEvent(
              new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
            );
            values.push(field.value);
          }
        } finally {
          Reflect.deleteProperty(field, 'getBoundingClientRect');
        }
        return { values, measurements };
      });
      assert.deepEqual(burst.values, [
        '',
        'か',
        'か',
        'かな',
        'かな',
        'かな',
        'かなし',
        'かなし',
        'かなしか',
        'かなしか',
        'かなしかっ',
        'かなしかった',
      ]);
      assert.equal(
        burst.measurements,
        0,
        'a key burst should not measure inline preedit synchronously',
      );
      await panel.waitFor({ state: 'hidden' });
      await typeKeys('Kanji');
      assert.equal(await panel.isVisible(), true);
      assert.match(await uiText(), /▽かんじ/);
      await page.keyboard.press('Space');
      assert.equal(await panel.isVisible(), true);
      assert.match(await uiText(), /▼漢字/);
      const compact = await panel.boundingBox();
      assert.ok(compact && compact.width <= 320 && compact.height <= 60, JSON.stringify(compact));
      await page.locator('#input').focus();
      await panel.waitFor({ state: 'hidden' });
      await reset();
      await typeKeys('Kanji ');
      await page.keyboard.press('Enter');
      await panel.waitFor({ state: 'hidden' });
      await typeKeys('Kanji ');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'hidden' });
      console.log(
        `${name}: hidden direct hiragana, katakana badge and preedit, compact candidates, blur, confirmation and cancellation passed`,
      );
      await reset();
      await typeKeys('Jisho ');
      assert.match(await uiText(), /▼辞書/);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await reset();
      await typeKeys("kon'nichiha");
      assert.equal(await page.locator('#text').inputValue(), 'こんにちは');

      await reset();
      await typeKeys('Kanji');
      assert.equal(await page.locator('#text').inputValue(), '');
      assert.match(await uiText(), /▽かんじ/);
      await page.keyboard.press('Space');
      assert.match(await uiText(), /▼漢字/);
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '感じ');
      assert.equal(await page.evaluate(() => window.submits), 0);

      await reset();
      await page.keyboard.down('Shift');
      await page.keyboard.press('K');
      await page.keyboard.press('A');
      await page.keyboard.up('Shift');
      await typeKeys('nji');
      assert.match(await uiText(), /▽かんじ/);
      await page.keyboard.press('Space');
      assert.match(await uiText(), /▼感じ/);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '感じ');
      await reset();
      await typeKeys('KAKu');
      assert.match(await uiText(), /▼書く/);
      assert.equal(await page.locator('.backdrop').isVisible(), false);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '書く');
      await reset();
      await typeKeys('KaKu');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '書く');
      await reset();
      await typeKeys('Nihon ');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#text').inputValue(), '');

      await reset('#input', 'alpha OLD omega');
      await page.evaluate(() =>
        document.querySelector<HTMLInputElement>('#input')!.setSelectionRange(6, 9),
      );
      await typeKeys('Nihon ');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#input').inputValue(), 'alpha 日本 omega');

      await reset('#controlled');
      await typeKeys('kana');
      assert.equal(await page.locator('#controlled').inputValue(), 'かな');
      assert.equal(await page.evaluate(() => window.controlledChanged), true);
      console.log(`${name}: text and controlled inputs passed`);

      await page.locator('#rich').focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Control+j');
      await typeKeys('Nihon ');
      await page.keyboard.press('Enter');
      assert.match((await page.locator('#rich').textContent()) ?? '', /prefix: 日本$/);
      assert.equal(await page.locator('#rich b').textContent(), 'prefix:');
      await page.keyboard.press('Control+z');
      assert.doesNotMatch((await page.locator('#rich').textContent()) ?? '', /日本/);
      // A host editor can acknowledge a commit after the next consonant arrives.
      // A redraw can also replace the text node while preserving the caret.
      await page.evaluate(() =>
        localStorage.setItem('skk.dictionary.v1', JSON.stringify('はんえい /反映/')),
      );
      await load();
      for (const change of ['notify', 'redraw', 'both', 'external', 'move']) {
        await reset('#rich');
        await typeKeys('Hannei ');
        if (change === 'both') await page.keyboard.press('Enter');
        await typeKeys('s'); // Also implicitly confirms the candidate when Enter was omitted.
        assert.equal(await page.locator('#rich').textContent(), '反映');
        await page.evaluate((change) => {
          const rich = document.querySelector<HTMLElement>('#rich')!;
          const selection = document.getSelection()!;
          if (change === 'redraw' || change === 'both') {
            rich.replaceChildren(document.createTextNode(rich.textContent));
            selection.collapse(rich.firstChild!, rich.textContent!.length);
          } else if (change === 'external') {
            rich.textContent = '外部';
            selection.collapse(rich.firstChild!, rich.textContent!.length);
          } else if (change === 'move') {
            selection.collapse(rich.firstChild!, 0);
          }
          if (change === 'notify' || change === 'both' || change === 'external')
            rich.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }, change);
        await typeKeys('arezu');
        const expected =
          change === 'external' ? '外部あれず' : change === 'move' ? 'あれず反映' : '反映されず';
        assert.equal(await page.locator('#rich').textContent(), expected, change);
      }
      // A controlled editor can apply the candidate itself and cancel native
      // insertion. Its synthetic composition events must not disable SKK.
      await reset('#rich');
      await page.evaluate(() => {
        const rich = document.querySelector<HTMLElement>('#rich')!;
        rich.addEventListener(
          'beforeinput',
          (event) => {
            event.preventDefault();
            rich.textContent = (event as InputEvent).data;
            document.getSelection()!.collapse(rich.firstChild!, rich.textContent!.length);
            setTimeout(() => {
              rich.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
              rich.dataset.compositionDispatched = 'true';
            }, 0);
          },
          { once: true },
        );
      });
      await typeKeys('Hannei ');
      assert.match(await uiText(), /▼反映/);
      await typeKeys('s');
      await page.waitForFunction(
        () => document.querySelector<HTMLElement>('#rich')!.dataset.compositionDispatched,
      );
      await typeKeys('arezu');
      assert.equal(await page.locator('#rich').textContent(), '反映されず');

      // Exercise the Discord-style Slate shape and delay DOM and caret
      // acknowledgment separately. Later kana must wait and insert once.
      for (const abandon of [false, true]) {
        await reset('#slate');
        await page.evaluate(() => {
          const root = document.querySelector<HTMLElement>('#slate')!;
          const selection = document.getSelection()!;
          const block = document.createElement('div');
          block.dataset.slateNode = 'element';
          const leaf = document.createElement('span');
          leaf.dataset.slateZeroWidth = 'n';
          leaf.textContent = '\uFEFF';
          block.append(leaf);
          root.replaceChildren(block);
          selection.collapse(leaf.firstChild!, 1);
          window.slateWrites = [];
          window.slateEnters = 0;
          root.onkeydown = (event) => {
            if (event.key === 'Enter') window.slateEnters++;
          };
          root.onbeforeinput = (event) => {
            if (!(event instanceof InputEvent)) return;
            if (event.inputType !== 'insertFromPaste') return;
            const text = event.dataTransfer?.getData('text/plain');
            if (!text) return;
            const [range] = event.getTargetRanges();
            if (!range || !root.contains(range.startContainer)) return;
            event.preventDefault();
            window.slateWrites.push(text);
            if (window.slateWrites.length === 1) {
              window.applySlate = () => {
                const value = document.createElement('span');
                value.dataset.slateString = 'true';
                value.textContent = text;
                block.replaceChildren(value);
                selection.collapse(value.firstChild!, 0);
                root.dispatchEvent(new InputEvent('input', { bubbles: true }));
                window.moveSlateCaret = () => selection.collapse(value.firstChild!, text.length);
              };
            } else {
              const leafText = block.firstChild!.firstChild as Text;
              leafText.appendData(text);
              selection.collapse(leafText, leafText.length);
            }
          };
        });
        await typeKeys('Hannei ');
        await typeKeys('sarezu');
        await page.keyboard.press('Enter');
        assert.deepEqual(await page.evaluate(() => window.slateWrites), ['反映']);
        assert.equal(await page.evaluate(() => window.slateEnters), 0);
        await page.evaluate(() => window.applySlate());
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
        assert.deepEqual(await page.evaluate(() => window.slateWrites), ['反映']);
        if (abandon) {
          await page.locator('#input').focus();
          await page.evaluate(() => window.moveSlateCaret());
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
          assert.equal(await page.locator('#slate').textContent(), '反映');
        } else {
          await page.evaluate(() => window.moveSlateCaret());
          await page.waitForFunction(
            () => document.querySelector<HTMLElement>('#slate')!.textContent === '反映されず',
          );
          assert.deepEqual(await page.evaluate(() => window.slateWrites), ['反映', 'されず']);
        }
      }

      await page.evaluate(() => localStorage.removeItem('skk.dictionary.v1'));
      await load();
      console.log(`${name}: contenteditable passed`);

      await reset();
      await typeKeys('Nihon');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#text').inputValue(), 'にほん');
      await reset();
      await typeKeys('Nihon');
      await page.locator('#input').focus();
      assert.equal(await page.locator('#text').inputValue(), 'にほん');

      await reset('#password');
      await typeKeys('kana');
      assert.equal(await page.locator('#password').inputValue(), 'kana');
      await reset('#optout');
      await typeKeys('kana');
      assert.equal(await page.locator('#optout').inputValue(), 'kana');
      await page.locator('#readonly').focus();
      await page.keyboard.press('Control+j');
      await typeKeys('kana');
      assert.equal(await page.locator('#readonly').inputValue(), '');

      await reset('textarea#shadow');
      await typeKeys('kana');
      assert.equal(await page.locator('textarea#shadow').inputValue(), 'かな');
      console.log(`${name}: exclusions and shadow passed`);

      await reset();
      await typeKeys('Nihon');
      await page.evaluate(() => {
        const t = document.querySelector<HTMLTextAreaElement>('#text')!;
        t.value = 'external';
        t.setSelectionRange(8, 8);
      });
      await typeKeys('a');
      assert.equal(await page.locator('#text').inputValue(), 'externalあ');

      if (name === 'chromium') {
        // Drive Chromium's native IME path, which emits trusted composition events.
        await reset();
        const session = await page.context().newCDPSession(page);
        await session.send('Input.imeSetComposition', {
          text: 'に',
          selectionStart: 1,
          selectionEnd: 1,
        });
        assert.equal(await page.locator('#text').inputValue(), 'に');
        await session.send('Input.insertText', { text: '日本' });
        await session.detach();
        await typeKeys('kana');
        assert.equal(await page.locator('#text').inputValue(), '日本かな');
      }

      await reset();
      await page.evaluate(() =>
        document
          .querySelector<HTMLTextAreaElement>('#text')!
          .addEventListener('beforeinput', (e) => {
            if (e instanceof InputEvent && e.data === 'あ') e.preventDefault();
          }),
      );
      await typeKeys('a');
      assert.equal(await page.locator('#text').inputValue(), '');

      // Missing candidate opens registration; cancel retains preedit; accept saves.
      await reset();
      await typeKeys('Michi ');
      await page.getByRole('button', { name: '取消', exact: true }).click();
      assert.match(await uiText(), /▽みち/);
      await page.keyboard.press('Space');
      await page.getByRole('textbox', { name: '登録する単語' }).fill('道');
      await page.getByRole('button', { name: '登録', exact: true }).click();
      assert.equal(await page.locator('#text').inputValue(), '道');
      await page.waitForFunction(() => {
        const stored = localStorage.getItem('skk.user.v1');
        const dictionary = stored ? (JSON.parse(stored) as Record<string, string[]>) : {};
        return dictionary['みち']?.[0] === '道';
      });

      await load();
      await reset();
      await typeKeys('Michi ');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#text').inputValue(), '道');
      await reset();
      await typeKeys('Kanji ');
      assert.match(await uiText(), /▼感じ/);
      await page.keyboard.press('Enter');

      // Import a local UTF-8 dictionary through the actual settings UI.
      await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']!());
      await page.getByLabel('SKK 辞書ファイル').setInputFiles({
        name: 'SKK-JISYO.test',
        mimeType: 'text/plain',
        buffer: Buffer.from(
          'てすと /試験;annotation/<img onerror=alert(1)>/' +
            '長い候補'.repeat(40) +
            '/四番/五番/六番/\nじしょ /字書/\nよi /良/\n',
          'utf8',
        ),
      });
      await page.waitForFunction(() => window.__skkUI.textContent?.includes('3 見出しを保存'));
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      for (const text of ['YoI', 'YOI']) {
        await reset();
        await typeKeys(text);
        assert.match(await uiText(), /▼良い/);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#text').inputValue(), '良い');
      }
      await reset();
      await typeKeys('Jisho ');
      assert.match(await uiText(), /▼字書/);
      await page.keyboard.press('Space');
      assert.match(await uiText(), /▼辞書/);
      await page.keyboard.press('Enter');
      await reset();
      await typeKeys('Tesuto ');
      assert.match(await uiText(), /▼試験/);
      await page.keyboard.press('Space');
      assert.match(await uiText(), /<img onerror=alert\(1\)>/);
      assert.equal(await page.locator('img').count(), 0);
      await page.setViewportSize({ width: 280, height: 400 });
      await page.keyboard.press('Space');
      const small = await panel.boundingBox();
      assert.ok(
        small &&
          small.width <= 264 &&
          small.height <= 60 &&
          small.x >= 8 &&
          small.x + small.width <= 272,
        JSON.stringify(small),
      );
      await page.keyboard.press('Space');
      await page.keyboard.press('Space');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('.candidates .selected').textContent(), '1. 六番');
      await page.locator('.candidates .selected').click();
      assert.equal(await page.locator('#text').inputValue(), '六番');
      await panel.waitFor({ state: 'hidden' });
      await page.setViewportSize({ width: 1000, height: 850 });

      await reset();
      await typeKeys('KaKu');
      await page.screenshot({
        path: new URL(`../test-results/${name}.png`, import.meta.url).pathname,
      });
      await load('blob');
      await reset();
      await typeKeys('Jisho ');
      assert.match(await uiText(), /▼辞書/);
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']!());
      assert.match(await uiText(), /SKK-JISYO.L を使用中/);
      await load('missing');
      await reset();
      await typeKeys('Nihon ');
      assert.match(await uiText(), /▼日本/);
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']!());
      assert.match(await uiText(), /内蔵小辞書を使用中/);
      if (upstreamResource) {
        await load('full');
        await reset();
        await typeKeys('Nihon ');
        assert.match(await uiText(), /▼日本/);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#text').inputValue(), '日本');
        await page.evaluate(() => window.__menus['SKK: 辞書設定 / Dictionary settings']!());
        assert.match(await uiText(), /SKK-JISYO.L を使用中/);
        const count = Number(
          (await page.locator('.dialog p').first().textContent())!
            .match(/現在 ([\d,]+) 見出し/)![1]!
            .replaceAll(',', ''),
        );
        assert.ok(count > 100000, String(count));
        console.log(`${name}: real SKK-JISYO.L EUC-JP resource (${count} entries) passed`);
      }
      assert.deepEqual(errors, []);
      console.log(
        `${name}: input, candidate/okuri, selection, controlled input, rich-text undo, shadow DOM, excluded fields, cancellation, registration, persistence, dictionary import and text safety passed`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
