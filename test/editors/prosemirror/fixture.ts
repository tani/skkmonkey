import { EditorState as PMState, TextSelection } from 'prosemirror-state';
import { EditorView as PMView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';
import { history as pmHistory, undo, redo } from 'prosemirror-history';
import { baseKeymap } from 'prosemirror-commands';
import { keymap as pmKeymap } from 'prosemirror-keymap';
import 'prosemirror-view/style/prosemirror.css';
import { fixtures, container } from '../shared/fixture.ts';

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
