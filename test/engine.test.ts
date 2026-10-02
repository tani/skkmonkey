// Test keystrokes are intentionally iterated as Unicode code points.
/* oxlint-disable typescript/no-misused-spread */
import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.ts';
import { Dictionary, parseSkk, validUserEntries } from '../src/dictionary.ts';
import { Romaji } from '../src/romaji.ts';
import { starterDictionary } from '../src/starter-dictionary.ts';

function make() {
  const engine = new Engine(new Dictionary(starterDictionary));
  engine.handle('C-j');
  return engine;
}
function type(engine: Engine, text: string): string {
  return [...text].map((key) => engine.handle(key).committed).join('');
}

test('direct hiragana, nasal boundaries, small kana, doubled consonants and symbols', () => {
  const e = make();
  assert.equal(
    type(e, "kon'nichihasekai.gakkouxya n'ya zhz "),
    'こんにちはせかい。がっこうゃ んや ←　',
  );
});
test('romaji preserves invalid sequences and finalizes n', () => {
  const r = new Romaji();
  assert.equal(r.feed('n'), '');
  assert.equal(r.feed('k'), 'ん');
  assert.equal(r.feed('a'), 'か');
  assert.equal(r.feed('@'), '@');
  r.feed('n');
  assert.equal(r.flush(), 'ん');
});
test('Shift begins reading; Space selects, x backs up, Enter confirms and learns', () => {
  const e = make();
  assert.equal(type(e, 'Kanji'), '');
  assert.equal(e.preedit, '▽かんじ');
  e.handle(' ');
  assert.equal(e.preedit, '▼漢字');
  e.handle(' ');
  assert.equal(e.preedit, '▼感じ');
  e.handle('x');
  assert.equal(e.preedit, '▼漢字');
  e.handle(' ');
  assert.equal(e.handle('Enter').committed, '感じ');
  assert.equal(e.phase, 'direct');
  type(e, 'Kanji ');
  assert.equal(e.preedit, '▼感じ');
});
test('number keys select and commit candidates on the visible candidate page', () => {
  const e = make();
  e.dictionary.base.set(
    'ためし',
    Array.from({ length: 7 }, (_, index) => ({ text: `候補${index + 1}` })),
  );
  type(e, 'Tameshi ');
  assert.equal(e.preedit, '▼候補1');
  assert.equal(e.handle('3').committed, '候補3');
  assert.equal(e.phase, 'direct');

  type(e, 'Tameshi ');
  for (let index = 0; index < 5; index++) e.handle(' ');
  assert.equal(e.preedit, '▼候補6');
  assert.equal(e.handle('2').committed, '候補7');
  assert.equal(e.phase, 'direct');

  type(e, 'Tameshi ');
  for (let index = 0; index < 5; index++) e.handle(' ');
  assert.equal(e.handle('5').committed, '');
  assert.equal(e.phase, 'candidate');
  assert.equal(e.preedit, '▼候補6');
});
test('candidate commits before subsequent typing without dropping pending romaji', () => {
  const e = make();
  type(e, 'Nihon ');
  assert.equal(type(e, 'go'), '日本ご');
  assert.equal(e.preedit, '');
});
test('okuri converts automatically and uses canonical kana consonants', () => {
  const e = make();
  type(e, 'KaKu');
  assert.equal(e.key, 'かk');
  assert.equal(e.preedit, '▼書く');
  assert.equal(e.handle('Enter').committed, '書く');
  type(e, 'TabeRu');
  assert.equal(e.preedit, '▼食べる');
  assert.equal(e.handle('Enter').committed, '食べる');
  e.dictionary.base.set('まt', [{ text: '待' }]);
  type(e, 'MaChi');
  assert.equal(e.key, 'まt');
  assert.equal(e.handle('Enter').committed, '待ち');
});

test('uppercase letters complete pending syllables before starting okuri', () => {
  const e = make();
  for (const text of ['XX', 'KA', 'YO', 'NI', 'SHI', 'KAnji']) {
    for (const key of text) {
      const result = e.handle(key);
      assert.equal(result.registration, undefined, text);
      assert.equal(result.committed, '', text);
      assert.equal(e.phase, 'reading', text);
      assert.equal(e.okuriCode, '', text);
    }
    e.handle('Escape');
  }
  type(e, 'KAnji');
  assert.equal(e.preedit, '▽かんじ');
  e.handle(' ');
  assert.equal(e.preedit, '▼漢字');
  e.handle('Enter');
  for (const text of ['KaKu', 'KAKu', 'KAKU']) {
    type(e, text);
    assert.equal(e.preedit, '▼書く', text);
    assert.equal(e.handle('Enter').committed, '書く', text);
  }
  e.dictionary.base.set('よi', [{ text: '良' }]);
  for (const text of ['YoI', 'YOI']) {
    type(e, text);
    assert.equal(e.key, 'よi', text);
    assert.equal(e.preedit, '▼良い', text);
    assert.equal(e.handle('Enter').committed, '良い', text);
  }
  e.dictionary.base.set('しn', [{ text: '死' }]);
  type(e, 'SHINu');
  assert.equal(e.preedit, '▼死ぬ');
  e.handle('Enter');
  type(e, 'TAbeRu');
  assert.equal(e.preedit, '▼食べる');
  e.handle('Enter');
  type(e, ';kaKu');
  assert.equal(e.preedit, '▼書く');
  e.handle('Enter');
  type(e, '/HTTP ');
  assert.equal(e.abbrev, true);
  assert.equal(e.reading, 'HTTP');
  e.handle('Escape');
});
test('uppercase syllable handling works after confirmation, cancellation and mode changes', () => {
  const e = make();
  type(e, 'Ka');
  e.handle('Enter');
  type(e, 'KA');
  assert.equal(e.preedit, '▽か');
  e.handle('Escape');
  type(e, 'Ka');
  e.handle('Escape');
  type(e, 'KA');
  assert.equal(e.preedit, '▽か');
  e.handle('C-j');
  type(e, 'KA');
  assert.equal(e.preedit, '▽か');
  e.handle('Escape');
  type(e, 'KaKu');
  assert.equal(e.preedit, '▼書く');
});
test('nasal immediately before uppercase okuri and doubled okuri consonants', () => {
  const e = make();
  e.dictionary.base.set('しんd', [{ text: '死ん' }]);
  type(e, 'ShinDa');
  assert.equal(e.preedit, '▼死んだ');
  e.handle('Enter');
  e.dictionary.base.set('おくt', [{ text: '送' }]);
  type(e, 'OkuTta');
  assert.equal(e.preedit, '▼送った');
});
test('cancel candidate retains reading; cancel reading clears it without insertion', () => {
  const e = make();
  type(e, 'Nihon ');
  e.handle('C-g');
  assert.equal(e.preedit, '▽にほん');
  const r = e.handle('C-g');
  assert.equal(r.committed, '');
  assert.equal(e.active, false);
});
test('backspace traverses pending romaji, okuri, reading and conversion boundaries', () => {
  const e = make();
  type(e, 'Kak');
  e.handle('Backspace');
  assert.equal(e.preedit, '▽か');
  e.handle('Backspace');
  assert.equal(e.preedit, '▽');
  e.handle('Backspace');
  assert.equal(e.active, false);
  type(e, 'KaKu');
  e.handle('Backspace');
  assert.equal(e.phase, 'okuri');
  e.handle('Backspace');
  assert.equal(e.okuri, '');
  e.handle('Backspace');
  assert.equal(e.phase, 'reading');
});
test('q switches kana modes or commits reading in the other script', () => {
  const e = make();
  assert.equal(type(e, 'qkatakana'), 'カタカナ');
  assert.equal(type(e, 'qkana'), 'かな');
  type(e, 'Nihonq');
  assert.equal(e.phase, 'direct');
  assert.equal(e.mode, 'hiragana');
  type(e, 'Nihon');
  assert.equal(e.handle('q').committed, 'ニホン');
});
test('ASCII and fullwidth input, abbreviation lookup, kana reactivation', () => {
  const e = make();
  e.handle('l');
  assert.equal(e.handle('a').handled, false);
  e.handle('C-j');
  e.handle('L');
  assert.equal(type(e, 'Ab 12'), 'Ａｂ　１２');
  e.handle('C-j');
  type(e, '/skk ');
  assert.equal(e.handle('Enter').committed, 'SKK');
});
test('registration request does not destroy reading or okuri; registered words persist', () => {
  const e = make();
  type(e, 'Michi ');
  assert.equal(e.handle(' ').registration?.key, 'みち');
  assert.equal(e.register('道'), '道');
  type(e, 'Michi ');
  assert.equal(e.preedit, '▼道');
  e.handle('Enter');
  type(e, 'NeMu');
  assert.equal(e.handle(' ').registration?.key, 'ねm');
  assert.equal(e.register('眠'), '眠む');
  assert.equal(e.dictionary.lookup('ねm')[0]?.text, '眠');
});
test('Enter commits pending n; idle Enter and idle Escape are left to the page', () => {
  const e = make();
  type(e, 'n');
  assert.equal(e.handle('Enter').committed, 'ん');
  assert.equal(e.handle('Enter').handled, false);
  assert.equal(e.handle('Escape').handled, false);
});
test('dictionary parser supports annotations, CRLF, BOM and duplicate entries', () => {
  const dict = parseSkk('\uFEFF;; comment\r\nかな /仮名;annotation/かな/\r\nかな /仮名/カナ/\n');
  assert.deepEqual(dict.get('かな'), [
    { text: '仮名', annotation: 'annotation' },
    { text: 'かな' },
    { text: 'カナ' },
  ]);
});
test('dictionary expressions are never executed and okuri-specific blocks are skipped', () => {
  const dict = parseSkk('かk /書/描/[く/書/]/(concat "evil")/\n');
  assert.deepEqual(dict.get('かk'), [{ text: '書' }, { text: '描' }]);
});
test('personal entries validate unsafe data and survive export/import', () => {
  assert.deepEqual(
    Object.keys(validUserEntries({ safe: ['安全', 'bad/word', null], bad: 'bad' })),
    ['safe'],
  );
  const d = new Dictionary();
  d.learn('__proto__', '安全');
  d.learn('かな', '仮名');
  d.learn('かな', 'かな');
  d.learn('かな', '仮名');
  d.learn('bad key', 'ignored');
  const imported = new Dictionary(d.exportUser());
  assert.equal(imported.lookup('かな')[0]?.text, '仮名');
  assert.equal(imported.lookup('__proto__')[0]?.text, '安全');
});
