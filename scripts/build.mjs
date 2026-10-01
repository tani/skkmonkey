import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const upstreamLicense = await readFile(new URL('../LICENSE.skkeleton', import.meta.url), 'utf8');
const banner = `// ==UserScript==
// @name         SKK Browser IME
// @namespace    cc.tani.skk-userscript
// @version      ${pkg.version}
// @description  Local SKK Japanese input; TypeScript, skkeleton kana rules, local dictionaries
// @match        https://*/*
// @match        http://*/*
// @run-at       document-end
// @sandbox      raw
// @inject-into  page
// @resource     SKK_JISYO_L https://raw.githubusercontent.com/skk-dev/dict/master/SKK-JISYO.L
// @grant        GM_getResourceURL
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT; kana table: Zlib
// ==/UserScript==
/*
Kana rules derived from vim-skk/skkeleton (altered browser version).
${upstreamLicense}
*/`;
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL('../src/userscript.ts', import.meta.url).pathname],
  outfile: new URL('../dist/skk-ime.user.js', import.meta.url).pathname,
  bundle: true, format: 'iife', platform: 'browser', target: ['chrome110', 'firefox115'],
  banner: { js: banner }, legalComments: 'inline', charset: 'utf8',
  sourcemap: false, minify: false,
});
console.log('Built dist/skk-ime.user.js (standalone; no runtime dependencies)');
