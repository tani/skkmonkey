import { EditorView, keymap } from '@codemirror/view';
import { EditorState as CMState, EditorSelection, Compartment } from '@codemirror/state';
import { history as cmHistory, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { fixtures, container } from '../shared/fixture.ts';

const access = new Compartment();
const cmExtensions = () => [
  cmHistory(),
  keymap.of([...historyKeymap, ...defaultKeymap]),
  CMState.allowMultipleSelections.of(true),
  access.of([CMState.readOnly.of(false), EditorView.editable.of(true)]),
];
const makeView = (value: string) =>
  new EditorView({
    parent: container('cm6'),
    state: CMState.create({
      doc: value,
      selection: { anchor: value.length },
      extensions: cmExtensions(),
    }),
  });
let cm6 = makeView('');
fixtures.cm6 = {
  get: () => cm6.state.doc.toString(),
  cursor: () => cm6.state.selection.main.head,
  focus: () => cm6.focus(),
  set: (value: string) => {
    // Old CM6 setState does not reset its EditContext document window. Recreate
    // the fixture rather than leave an out-of-sync browser buffer between tests.
    const focused = cm6.hasFocus;
    cm6.destroy();
    cm6 = makeView(value);
    if (focused) cm6.focus();
  },
  select: (from: number, to: number) => cm6.dispatch({ selection: { anchor: from, head: to } }),
  readonly: (value: boolean) =>
    cm6.dispatch({
      effects: access.reconfigure([CMState.readOnly.of(value), EditorView.editable.of(!value)]),
    }),
  multi: () =>
    cm6.dispatch({
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(2)]),
    }),
};
