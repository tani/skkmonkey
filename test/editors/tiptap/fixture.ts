import { Editor as Tiptap } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState as PMState, TextSelection } from 'prosemirror-state';
import { fixtures, container } from '../shared/fixture.ts';

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
