import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createEditor, Editor, Node, Transforms, type Descendant } from 'slate';
import { withHistory } from 'slate-history';
import { Editable, ReactEditor, Slate, withReact } from 'slate-react';
import { container, fixtures } from '../shared/fixture.ts';

const editor = withReact(withHistory(createEditor()));
const root = createRoot(container('slate'));
const paragraph = (text: string): Descendant[] => [{ children: [{ text }] }];
const initialValue = paragraph('');
let readOnly = false;
let deferNext = false;
let deferred: (() => void) | undefined;

function render(): void {
  flushSync(() => {
    root.render(
      createElement(Slate, {
        editor,
        initialValue,
        children: createElement(Editable, {
          'aria-label': 'Message #test',
          placeholder: 'Message #test',
          readOnly,
          onDOMBeforeInput(event) {
            if (!deferNext || event.inputType !== 'insertFromPaste') return;
            const [target] = event.getTargetRanges();
            const data = event.dataTransfer;
            if (!target || !data) throw new Error('Missing Slate insertion range or text');
            const selection = ReactEditor.toSlateRange(editor, target, {
              exactMatch: false,
              suppressThrow: true,
            });
            if (!selection) throw new Error('Unable to resolve Slate insertion range');
            event.preventDefault();
            deferNext = false;
            deferred = () => {
              Transforms.select(editor, selection);
              ReactEditor.insertData(editor, data);
            };
          },
        }),
      }),
    );
  });
}

render();
fixtures.slate = {
  get: () => Node.string(editor),
  set: (text: string) => {
    flushSync(() => {
      editor.children = paragraph(text);
      const point = Editor.end(editor, []);
      editor.selection = { anchor: point, focus: point };
      editor.history = { undos: [], redos: [] };
      editor.onChange();
    });
  },
  select: (start: number, end: number) =>
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: start },
      focus: { path: [0, 0], offset: end },
    }),
  cursor: () => editor.selection?.focus.offset,
  focus: () => ReactEditor.focus(editor),
  readonly: (value: boolean) => {
    readOnly = value;
    render();
  },
  deferNext: () => {
    deferNext = true;
  },
  release: () => {
    if (!deferred) throw new Error('No deferred Slate insertion');
    const insert = deferred;
    deferred = undefined;
    insert();
  },
};
