# Validation — v0.2.0, 2026-10-01

- Node.js 24.19.0: TypeScript strict typecheck passed; 15 Node tests passed.
- esbuild: standalone `dist/skk-ime.user.js` built successfully.
- Playwright 1.62.1: the actual bundle passed integration checks in Firefox 153
  and Chromium 153 using a local fixture and userscript-manager API shims.
- Verified direct kana, candidate selection/learning, automatic okuri, cancel,
  selected-text replacement, controlled-input notification, contenteditable
  markup preservation and native undo, focus/navigation commit, open Shadow DOM,
  password/readonly/opt-out exclusion, stale bookmark protection, native
  composition pass-through, cancelable beforeinput, registration cancellation
  and acceptance, persistence across reload, UTF-8 dictionary import, and
  dictionary markup rendered as inert text.

The Firefox executable was supplied by the runtime. Chromium was supplied via
an npm-distributed headless binary after the browser download endpoint returned
invalid archives. Browser sandbox flags were adjusted for the container only.
Those binaries and flags are not part of the userscript or source distribution.

Actual Tampermonkey/Violentmonkey extension installation and arbitrary third-party
web editors were not tested. See README.md for support limits and installation.

## Real component integration

`npm run test:editors` passed with actual npm-distributed editor components in
Chromium 153 and Firefox 153. The production userscript bundle is injected in
page context with local GM API shims. No library instances are used by the
production adapter; only test setup/assertions have access to model APIs.

| Configuration | Chromium | Firefox |
| --- | --- | --- |
| Monaco 0.57.0, textarea input | Passed | Passed |
| Monaco 0.57.0, native EditContext | Passed | Browser API unavailable; skipped |
| CodeMirror 5.65.21, textarea input | Passed | Passed |
| CodeMirror view 6.43.13 / state 6.7.6 | Passed | Passed |
| ProseMirror view 1.42.6 / state 1.4.4 | Passed | Passed |
| Tiptap 3.31.4 with StarterKit | Passed | Passed |
| Quill 2.0.3 with user-only history | Passed | Passed |

Every configuration checks direct kana, ASCII/kana mode transitions, candidate
navigation, automatic okuri, selected-text replacement, undo and redo, cancellation,
candidate-button confirmation, word registration and focus/position restoration,
cursor movement, deletion, stale external edits, and read-only behavior. Native
EditContext also checks that its buffer matches the model after synchronization.
Monaco and both CodeMirror generations additionally check multiple-cursor
insertion; ProseMirror additionally checks preservation of strong marks.

The complete `npm run check` passed: strict typecheck, 15 engine tests, existing
DOM integration tests on both browsers, and all real component configurations.
Tests use each editor's default keymap/history configuration, except the explicit
read-only and multiple-selection cases. Unsupported/custom configurations and
page execution-context requirements are documented in README.md. No actual
userscript-manager extension session or arbitrary production website was tested.
