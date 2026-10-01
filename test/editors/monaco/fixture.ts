import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';

// Both Monaco versions use the Vite-built worker, including its dependencies.
globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() };

declare const SKK_PROFILE_NATIVE: boolean;
import { fixtures, container } from '../shared/fixture.ts';

function makeMonaco(name: string, nativeEditContext: boolean) {
  const editor = monaco.editor.create(container(name), {
    value: '',
    language: 'plaintext',
    automaticLayout: true,
    minimap: { enabled: false },
    editContext: nativeEditContext,
    accessibilitySupport: 'off',
    fontSize: 16,
    scrollBeyondLastLine: false,
  });
  fixtures[name] = {
    get: () => editor.getValue(),
    focus: () => editor.focus(),
    set: (value: string) => {
      editor.setValue(value);
      editor.setPosition({ lineNumber: 1, column: value.length + 1 });
    },
    select: (from: number, to: number) => {
      const model = editor.getModel()!;
      const a = model.getPositionAt(from);
      const b = model.getPositionAt(to);
      editor.setSelection({
        startLineNumber: a.lineNumber,
        startColumn: a.column,
        endLineNumber: b.lineNumber,
        endColumn: b.column,
      });
    },
    readonly: (value: boolean) => editor.updateOptions({ readOnly: value, domReadOnly: true }),
    undo: () => editor.trigger('test', 'undo', null),
    redo: () => editor.trigger('test', 'redo', null),
    multi: () =>
      editor.setSelections([new monaco.Selection(1, 1, 1, 1), new monaco.Selection(2, 1, 2, 1)]),
  };
}
makeMonaco('monaco', false);
if (SKK_PROFILE_NATIVE && 'EditContext' in window) makeMonaco('monaco-native', true);
else container('monaco-native').remove();
