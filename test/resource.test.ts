import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dictionary } from '../src/dictionary.ts';
import { loadResourceDictionary, mergeDictionaries } from '../src/resource.ts';

const bytes = Uint8Array.from(Buffer.from('a4b8a4b7a4e7202fbcadbdf12f0a', 'hex'));
const dataURL = 'data:text/plain;base64,' + Buffer.from(bytes).toString('base64');

test('cached EUC-JP resource loads from data URL without fetch, including async API', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not fetch data URL'); });
  const dictionary = await loadResourceDictionary(async (name, blob) => {
    assert.equal(name, 'SKK_JISYO_L'); assert.equal(blob, false); return dataURL;
  });
  assert.equal(dictionary?.lookup('じしょ')[0]?.text, '辞書');
});

test('cached EUC-JP resource loads from blob URL', async () => {
  const url = URL.createObjectURL(new Blob([bytes]));
  try {
    assert.equal((await loadResourceDictionary(() => url))?.lookup('じしょ')[0]?.text, '辞書');
  } finally { URL.revokeObjectURL(url); }
});

test('missing, malformed and empty resources fall back without remote requests', async t => {
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not fetch remote URLs'); });
  for (const url of ['', 'https://raw.githubusercontent.com/skk-dev/dict/master/SKK-JISYO.L',
    'data:text/plain;base64,!', 'data:text/plain;base64,/w==', 'data:text/plain;base64,']) {
    assert.equal(await loadResourceDictionary(() => url), null);
  }
  assert.equal(await loadResourceDictionary(() => { throw new Error('Resource missing'); }), null);
});

test('imported candidates override resource candidates; personal learning remains first', () => {
  const dictionary = new Dictionary('', { 'じしょ': ['学習'] });
  dictionary.base = mergeDictionaries(new Dictionary('じしょ /取込/辞書/'),
    new Dictionary('じしょ /辞書;annotation/字書/\nしげん /資源/'));
  assert.deepEqual(dictionary.lookup('じしょ').map(c => c.text), ['学習', '取込', '辞書', '字書']);
  assert.equal(dictionary.lookup('しげん')[0]?.text, '資源');
});
