import * as monaco from 'monaco-editor';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState as CMState, EditorSelection } from '@codemirror/state';
import { history as cmHistory, historyKeymap, defaultKeymap } from '@codemirror/commands';
import CodeMirror from 'codemirror5';
import 'codemirror5/lib/codemirror.css';
import { EditorState as PMState, TextSelection } from 'prosemirror-state';
import { EditorView as PMView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { history as pmHistory, undo, redo } from 'prosemirror-history';
import { baseKeymap } from 'prosemirror-commands';
import { keymap as pmKeymap } from 'prosemirror-keymap';
import 'prosemirror-view/style/prosemirror.css';
import { Editor as Tiptap } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

// Public APIs are used only by the tests to inspect/reset the real models.
// The userscript cannot access this module's instances.
const fixtures: Record<string, any> = {};
const container = (name: string) => document.querySelector<HTMLElement>('#' + name)!;

function makeMonaco(name: string, nativeEditContext: boolean) {
  const editor = monaco.editor.create(container(name), { value: '', language: 'plaintext',
    automaticLayout: true, minimap: { enabled: false }, editContext: nativeEditContext,
    accessibilitySupport: 'off', fontSize: 16, scrollBeyondLastLine: false });
  fixtures[name] = {
    get: () => editor.getValue(), focus: () => editor.focus(),
    set: (value: string) => { editor.setValue(value); editor.setPosition({ lineNumber: 1, column: value.length + 1 }); },
    select: (from: number, to: number) => {
      const model = editor.getModel()!; const a = model.getPositionAt(from); const b = model.getPositionAt(to);
      editor.setSelection({ startLineNumber: a.lineNumber, startColumn: a.column, endLineNumber: b.lineNumber, endColumn: b.column });
    },
    readonly: (value: boolean) => editor.updateOptions({ readOnly: value, domReadOnly: true }),
    undo: () => editor.trigger('test', 'undo', null), redo: () => editor.trigger('test', 'redo', null),
    multi: () => editor.setSelections([new monaco.Selection(1, 1, 1, 1), new monaco.Selection(2, 1, 2, 1)]),
  };
}
makeMonaco('monaco', false);
if ('EditContext' in window) makeMonaco('monaco-native', true);
else container('monaco-native').remove();

const cm5 = CodeMirror(container('cm5'), { value: '', lineNumbers: true, inputStyle: 'textarea' });
fixtures.cm5 = {
  get: () => cm5.getValue(), focus: () => cm5.focus(),
  set: (value: string) => { cm5.setValue(value); cm5.setCursor(cm5.posFromIndex(value.length)); cm5.clearHistory(); },
  select: (from: number, to: number) => cm5.setSelection(cm5.posFromIndex(from), cm5.posFromIndex(to)),
  readonly: (value: boolean) => cm5.setOption('readOnly', value),
  undo: () => cm5.undo(), redo: () => cm5.redo(),
  multi: () => cm5.setSelections([{ anchor: { line: 0, ch: 0 }, head: { line: 0, ch: 0 } }, { anchor: { line: 1, ch: 0 }, head: { line: 1, ch: 0 } }]),
};
const cm6 = new EditorView({ state: CMState.create({ doc: '', extensions: [cmHistory(), keymap.of([...historyKeymap, ...defaultKeymap]), CMState.allowMultipleSelections.of(true)] }), parent: container('cm6') });
const cmExtensions = (readonly = false) => [cmHistory(), keymap.of([...historyKeymap, ...defaultKeymap]), CMState.allowMultipleSelections.of(true), CMState.readOnly.of(readonly), EditorView.editable.of(!readonly)];
fixtures.cm6 = {
  get: () => cm6.state.doc.toString(), focus: () => cm6.focus(),
  set: (value: string) => cm6.setState(CMState.create({ doc: value, selection: { anchor: value.length }, extensions: cmExtensions() })),
  select: (from: number, to: number) => cm6.dispatch({ selection: { anchor: from, head: to } }),
  readonly: (value: boolean) => cm6.setState(CMState.create({ doc: cm6.state.doc, extensions: cmExtensions(value) })),
  multi: () => cm6.dispatch({ selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(2)]) }),
};

const pm = new PMView(container('pm'), { state: PMState.create({ schema, plugins: [pmHistory(), pmKeymap({ 'Mod-z': undo, 'Mod-y': redo }), pmKeymap(baseKeymap)] }) });
fixtures.pm = {
  get: () => pm.state.doc.textContent, focus: () => pm.focus(),
  set: (value: string) => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, value ? schema.text(value) : undefined)]);
    pm.updateState(PMState.create({ schema, doc, selection: TextSelection.create(doc, value.length + 1), plugins: [pmHistory(), pmKeymap({ 'Mod-z': undo, 'Mod-y': redo }), pmKeymap(baseKeymap)] }));
  },
  select: (from: number, to: number) => pm.dispatch(pm.state.tr.setSelection(TextSelection.create(pm.state.doc, from + 1, to + 1))),
  readonly: (value: boolean) => pm.setProps({ editable: () => !value }),
  marked: () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text('bold', [schema.marks.strong!.create()]))]);
    pm.updateState(PMState.create({ schema, doc, selection: TextSelection.create(doc, 5), plugins: [pmHistory()] }));
  },
  html: () => pm.dom.innerHTML,
};

const tiptap = new Tiptap({ element: container('tiptap'), extensions: [StarterKit], content: '<p></p>' });
fixtures.tiptap = {
  get: () => tiptap.getText(), focus: () => tiptap.view.focus(),
  set: (value: string) => {
    const doc = tiptap.schema.nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', ...(value ? { content: [{ type: 'text', text: value }] } : {}) }] });
    tiptap.view.updateState(PMState.create({ schema: tiptap.schema, doc,
      selection: TextSelection.create(doc, value.length + 1), plugins: tiptap.state.plugins }));
  },
  select: (from: number, to: number) => tiptap.commands.setTextSelection({ from: from + 1, to: to + 1 }),
  readonly: (value: boolean) => tiptap.setEditable(!value),
  html: () => tiptap.getHTML(),
};

const quill = new Quill(container('quill'), { theme: 'snow', modules: { toolbar: false, history: { userOnly: true } } });
fixtures.quill = {
  get: () => quill.getText().replace(/\n$/, ''), focus: () => quill.focus(),
  set: (value: string) => { quill.setText(value); quill.setSelection(value.length, 0); quill.history.clear(); },
  select: (from: number, to: number) => quill.setSelection(from, to - from),
  readonly: (value: boolean) => quill.enable(!value),
  html: () => quill.root.innerHTML,
};

// No editor instance or global monaco API is exposed to the input script.
// Tests cross this narrow interface solely for assertions/setup.
Object.assign(window, { fixture: fixtures, fixtureReady: true });
