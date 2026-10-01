# Validation — Scala.js v0.4.0, 2026-10-02

The `scala-js-rewrite` branch replaces all production TypeScript with Scala
3.3.6 / Scala.js 1.19.0. The Scala compiler passed with warnings treated as
errors. All **23 Scala.js MUnit tests** passed in Node.js, covering the former
engine/resource tests plus supplementary Unicode deletion and registration
validation.

The optimized, minified standalone userscript passed the ordinary browser suite
on Chromium 153.0.8010.0 and Firefox 153.0: compact UI, native and controlled
inputs, rich-text undo, open shadow DOM, excluded fields, selection, stale
bookmarks, cancellation, registration, storage, dictionary import and text
safety. Browser tests also passed with GM grants supplied only as lexical
wrapper bindings, with the corresponding window properties deleted.
The actual upstream EUC-JP SKK-JISYO.L loaded **175,787 combined headings**
and converted `Nihon` to `日本` in both browsers.

## Isolated editor version profiles

All 12 independent dependency environments were reinstalled with `npm ci` and
passed the common scenarios on both browsers (24 editor/profile/browser combinations).
Each profile has its own manifest and lockfile; direct fixture imports are
resolved into its own dependency tree. The combined baseline suite is retained.

| Profile             | Direct dependency pins                                                                                                                                                                             | Chromium | Firefox |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| codemirror5/legacy  | codemirror5 5.58.3                                                                                                                                                                                 | Passed   | Passed  |
| codemirror5/current | codemirror5 5.65.21                                                                                                                                                                                | Passed   | Passed  |
| codemirror6/legacy  | @codemirror/view 6.28.6 , @codemirror/state 6.4.1 , @codemirror/commands 6.6.0                                                                                                                     | Passed   | Passed  |
| codemirror6/current | @codemirror/view 6.43.13 , @codemirror/state 6.7.6 , @codemirror/commands 6.11.1                                                                                                                   | Passed   | Passed  |
| monaco/legacy       | monaco-editor 0.44.0                                                                                                                                                                               | Passed   | Passed  |
| monaco/current      | monaco-editor 0.57.0                                                                                                                                                                               | Passed   | Passed  |
| prosemirror/legacy  | prosemirror-state 1.4.3 , prosemirror-view 1.33.8 , prosemirror-model 1.22.3 , prosemirror-schema-basic 1.2.3 , prosemirror-history 1.4.1 , prosemirror-commands 1.6.0 , prosemirror-keymap 1.2.2  | Passed   | Passed  |
| prosemirror/current | prosemirror-state 1.4.4 , prosemirror-view 1.42.6 , prosemirror-model 1.25.12 , prosemirror-schema-basic 1.2.5 , prosemirror-history 1.5.1 , prosemirror-commands 1.7.2 , prosemirror-keymap 1.2.3 | Passed   | Passed  |
| quill/legacy        | quill 1.3.7                                                                                                                                                                                        | Passed   | Passed  |
| quill/current       | quill 2.0.3                                                                                                                                                                                        | Passed   | Passed  |
| tiptap/legacy       | @tiptap/core 2.11.5 , @tiptap/starter-kit 2.11.5 , @tiptap/pm 2.11.5 , prosemirror-state 1.4.3                                                                                                     | Passed   | Passed  |
| tiptap/current      | @tiptap/core 3.31.4 , @tiptap/starter-kit 3.31.4 , prosemirror-state 1.4.4                                                                                                                         | Passed   | Passed  |

Every profile checks direct kana, ASCII/kana mode transitions, candidate
navigation, automatic okuri, selected-text replacement, undo/redo, cancellation,
candidate-button confirmation, word registration and focus restoration, cursor
movement, deletion, stale external edits and read-only behavior. ProseMirror
also checks strong-mark preservation; Monaco and both CodeMirror generations
check multiple-cursor insertion.

Monaco 0.57.0 tests textarea and native EditContext on Chromium; Firefox lacks
that API. Monaco 0.44.0 uses textarea. Older CodeMirror 6 uses native EditContext
on Chromium and ordinary contenteditable on Firefox. Its fixture recreates the
view when resetting the document because the older setState API leaves its
EditContext window stale. All input scenarios still use actual Playwright
keyboard operations, not fixture model calls for typing.

## Adapter compatibility

Adapters and fixtures are separated into editor directories. Tiptap shares the
ProseMirror insertion implementation. Monaco and CodeMirror 6 choose their
ordinary-input/EditContext implementations by capabilities. Quill 1 uses a
single user Delta transaction through its container instance hook (also used by
Quill.find); its synthetic paste cannot supply the native browser default action.
Quill 2 uses its clipboard event handler. No editor library is bundled into the
production userscript.

GitHub Actions is configured for all 12 profiles on both browsers for pushes,
pull requests and manual runs, with four matrix jobs at a time. The matrix runner
writes dependency pins, browser selection, pass/fail and elapsed time to JSON.
Screenshots and failure screenshots are stored per editor/profile/browser.

These are tested version/configuration points, not proof that every intermediate
release, custom keymap, collaboration setup, mobile browser, or arbitrary site
works. Tests use local userscript-manager API shims. Live Tampermonkey/Violentmonkey
extension installations and manager-controlled resource downloads were not tested.
Browser executables were supplied through environment variables; Firefox sandbox
flags were adjusted for this container only. No such flags or binaries are shipped.

## Scala.js and Vite+ toolchain

sbt 1.10.7 compiles the Scala application and runs Scala.js MUnit tests in
Node.js. `fullLinkJS` optimizes the module, and Vite+ 1.0.0 / Rolldown minifies
and packages it as a standalone userscript. Build configuration is in
`build.sbt`, `project/` and `vite.config.ts`. Playwright drives all browser
tests; third-party editor fixture hosts remain TypeScript.

A clean `npm ci` succeeded. Vite+ formatting/lint/type checks and current
editor-fixture type checks passed. The checksum-verified sbt launcher bootstrap
was also tested after removing its cached JAR. Java 17 is required for building,
and no Java installation is needed in the browser.

The distributed artifact is approximately **371 kB** (**100 kB gzip**), compared
with the previous readable TypeScript artifact's 54 kB. This includes the
Scala.js runtime, collections, regex support and application. No editor library
or full dictionary is embedded. Bundle size remains a tradeoff of this port.

## Dependency isolation

Root dev dependencies are limited to Vite+, Playwright, and Node.js types.
The combined fixture now resolves each editor from its own current profile,
rather than from a duplicated root dependency set. CodeMirror 5 types are in
its current profile. Core static checks and current fixture type checks run
separately; the latter use the dedicated editor TypeScript and Oxlint configs.
The root lockfile contains no editor packages.
