# SKK Browser IME

An installable SKK Japanese input userscript for Firefox and Chrome, written in
TypeScript and built with Node.js. No Node.js server, extension build, remote IME,
or runtime dependency is needed to use the generated script.

This is an independent browser implementation of core SKK, **not a complete port
of skkeleton**. Its 242 romaji rules and canonical okuri mapping are derived from
[vim-skk/skkeleton](https://github.com/vim-skk/skkeleton), commit
`1f22a0600909b3c7b84e2a3e0d693014e4cb1d1d`. Vim/Denops integration is replaced by
a pure conversion engine and DOM input adapters. Altered upstream data retains
the original zlib notice in `LICENSE.skkeleton` and the generated userscript.

## Install

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/)
   or [Violentmonkey](https://violentmonkey.github.io/) in your browser.
2. Create a new script in the manager's editor. Replace its contents with
   **all of `dist/skk-ime.user.js`**, including the metadata header, then save it.
   If your manager supports installing a local `.user.js` file, that also works.
3. Reload the web page, focus a text input or textarea, and press **Ctrl+J**.
   Keep the operating-system IME in Latin/direct-input mode while using SKK.
4. Type `Nihon`, press Space, then Enter: `日本`.

The metadata enables the script on HTTP and HTTPS pages. You can narrow the
`@match` rules in the manager to the sites you use. Browser-internal pages and
extension stores cannot generally run userscripts. If Chrome requires additional
permission to execute userscripts, follow your manager's setup instructions.

## Keys

| Key | Action |
| --- | --- |
| Ctrl+Shift+Space | Toggle SKK between ASCII and hiragana |
| Ctrl+J | Enter hiragana mode; confirm existing preedit |
| Lowercase romaji | Insert kana directly |
| Uppercase initial, or `;` | Start a reading: `Kanji` gives `▽かんじ` |
| Uppercase inside reading | Begin okuri: `KaKu` selects `書く` automatically |
| Space | Convert reading; advance to next candidate |
| `x` during conversion | Previous candidate; return to reading from first candidate |
| Enter | Confirm preedit; an idle Enter passes to the web page |
| Ctrl+G / Escape | Cancel candidate selection to reading, then cancel reading |
| Backspace / Ctrl+H | Delete pending romaji, okuri, or reading |
| `q` | Toggle hiragana/katakana; convert a pending reading to the other script |
| `l` / `L` | ASCII / fullwidth ASCII mode; Ctrl+J returns to hiragana |
| `/` | Abbreviation input: `/skk` + Space gives `SKK` |
| Candidate button | Confirm the clicked candidate |

The table follows skkeleton's explicit `nn` / `n'` behavior: `nn` consumes both
letters as `ん`. For `こんにちは`, use `kon'nichiha` or `konnnichiha`.
Symbols include `zh` → `←`, `zj` → `↓`, `zk` → `↑`, `zl` → `→`, `z ` → ideographic
space, and `z.` → `…`. Comma and period become `、` and `。`.

Pending romaji and readings are displayed in a floating panel anchored to the
field. They enter the page only when committed. Moving the caret, pasting, or
leaving a field commits the pending reading as kana (or the selected candidate).
Escape cancels a pending reading without replacing the page's selected text.

## Dictionaries and learning

The bundled original starter dictionary has a small selection of common words
so you can try conversion immediately. For everyday use, obtain
`SKK-JISYO.L` from [skk-dev/dict](https://github.com/skk-dev/dict), respecting that
dictionary's license, and import it via your userscript manager's **SKK: 辞書設定 /
Dictionary settings** menu. The full dictionary is not bundled or downloaded
automatically.

- Import UTF-8 or EUC-JP SKK text files, up to 32 MiB. Auto detection attempts
  strict UTF-8, then strict EUC-JP. An explicit encoding is also available.
- Import replaces the previously imported dictionary; starter entries remain.
- Candidate annotations are shown on hover. Optional okuri-specific blocks and
  Lisp expression candidates are skipped; dictionary content is never executed.
- Missing entries, or Space past the last candidate, open a word-registration
  dialog. Enter the kanji stem using the OS IME or paste; okuri is appended
  automatically. Cancel returns to the original reading or candidate.
- Confirmed candidates are promoted to the front of the personal dictionary.
- Export registered and learned entries through the menu as UTF-8 SKK text.
- Imported and personal dictionaries use the manager's `GM_getValue` /
  `GM_setValue` storage. No typed text or lookup is sent over the network.
- Reload other tabs after importing a dictionary or learning words there. Live
  synchronization and conflict merging between simultaneously active tabs are
  not implemented; avoid simultaneous registration in multiple tabs.

## Editor support and limitations

Supported: writable text/search inputs, textareas, ordinary contenteditable
elements, and inputs inside open Shadow DOM. Password fields, readonly/disabled
fields, other input types, and elements within `[data-skk-disable]` are excluded.
Native OS composition is allowed through while active.

Text inputs use the native value setter followed by a bubbling `input` event,
with a cancelable `beforeinput` event. This works with the controlled-input
fixture in the browser tests; it is not a guarantee for every framework.
Contenteditable uses plain-text `insertText` for native undo, with a Range
fallback. Existing markup around the insertion is retained.

Model-driven components are detected automatically on their actual input surfaces:

| Component | Tested release | Integration |
| --- | --- | --- |
| Monaco | 0.57.0 | Textarea `input`; native EditContext composition/textupdate on Chromium |
| CodeMirror 5 | 5.65.21 | Plain-text paste through its document handler (textarea input style) |
| CodeMirror 6 | view 6.43.13 / state 6.7.6 | Plain-text paste through its transaction pipeline |
| ProseMirror | view 1.42.6 / state 1.4.4 | Plain-text paste through its transaction pipeline |
| Tiptap | 3.31.4 | ProseMirror integration, tested with StarterKit |
| Quill | 2.0.3 | Plain-text paste through its Clipboard module |

The userscript does not import these libraries at runtime, read private editor
instances, or require page-global `monaco`, `CodeMirror`, or `EditorView` objects.
The fixture uses each library's public APIs only to inspect the resulting model.
Committed text enters each editor's own model and undo history. Native
selection-change notifications are synchronized before rich-editor insertion;
registration restores the original selection when returning from the dialog.
Model-driven editor DOM is never edited with the generic Range fallback.

Monaco's native EditContext route uses short synthetic composition transactions.
Its full-buffer echo is normalized during that synchronous transaction, and the
original `updateText` method is restored immediately afterward. Real native
composition remains separate. Editor redraws and hidden-input resets after an
edit are allowed to settle before refreshing selection bookmarks.

Site-specific paste/input filters may transform or reject synthetic events;
custom editor extensions can therefore require additional adaptation. The tested
configurations do not establish compatibility with every website using these
libraries. Editors that require `event.isTrusted`, closed Shadow DOM, and other
canvas-rendered editors remain unsupported. Monaco's supported EditContext
surface is an explicit exception to the general canvas limitation. CodeMirror 5
contenteditable input style, Monaco diff editors, Vim/Emacs editor keymaps, and
collaborative editing configurations are not covered by this test matrix.

Programmatic changes to ordinary input values are not guaranteed to participate
in native browser undo history. The preedit panel is anchored to the component
or field edge, not the text caret. Synthetic clipboard events carry only local
plain text and never read or write the operating-system clipboard. The script
cannot produce trusted native events or act as an operating-system IME.

Not yet implemented: recursive SKK-based registration input, numeric conversion,
halfwidth katakana, AZIK/custom kana tables, skkserv, dictionary completion, or
okuri-block-specific candidate ordering. Registration uses the OS IME/paste.

## Develop

Node.js **22.18+** (or Node.js 24) and npm:

```sh
npm ci
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox
npm run test:browser
npm run test:editors
```

`npm run check` runs all checks after the browsers are installed. Browser tests
serve a local fixture, inject the actual built userscript with manager API shims,
and run in Chromium and Firefox. `test:editors` bundles and mounts real editor
components and checks their models, selection replacement, history, and read-only
behavior. Editor packages are development/test dependencies only. This checks
browser behavior, not installation
inside real Tampermonkey/Violentmonkey extension sessions.

The metadata explicitly requests **page execution context** (`@sandbox raw` for
Tampermonkey, `@inject-into page` for Violentmonkey). Editor handlers must observe
the same synthetic event payloads and EditContext method wrappers as the script.
Do not force this script into an isolated/content execution world. Pages where
the manager cannot perform page-context injection are outside this test scope.

To run one installed browser or specify a locally supplied executable:

```sh
SKK_TEST_BROWSERS=firefox npm run test:browser
SKK_TEST_BROWSERS=chromium SKK_TEST_CHROMIUM_PATH=/path/to/chromium npm run test:browser
npm run test:editors
```

Source layout:

| File | Responsibility |
| --- | --- |
| `src/engine.ts` | Pure SKK state machine, modes, reading, okuri, candidates |
| `src/romaji.ts`, `src/kana-table.ts`, `src/okuri.ts` | Kana conversion and upstream data |
| `src/dictionary.ts` | Safe SKK parser, personal ranking and export |
| `src/editor.ts` | Selection bookmarks, focus restoration, stale-edit checks, DOM insertion |
| `src/component.ts` | Component discovery, clipboard transactions, Monaco EditContext adapter |
| `src/ui.ts` | Isolated candidate panel and dictionary/registration dialog shell |
| `src/userscript.ts` | Keyboard, focus, native composition, storage, imports |
| `scripts/build.mjs` | Standalone IIFE bundle and userscript metadata |
| `test/engine.test.ts` | Node tests for SKK behavior and dictionaries |
| `scripts/browser-test.mjs` | End-to-end DOM integration checks |
| `scripts/editor-test.mjs`, `test/editors/fixture.ts` | Real component integration and model/history assertions |

License: MIT for the new implementation and original starter dictionary;
zlib for the derived skkeleton kana and okuri tables.
