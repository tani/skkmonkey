import type { EditorAdapter } from '../types.ts';
import { nativeContext } from '../shared/edit-context.ts';
import { typeIntoEditContext } from './edit-context.ts';
import { insertTextarea } from './textarea.ts';

export const adapter: EditorAdapter = {
  kind: 'monaco',
  detect(element) {
    // Exclude search, toolbar and widget inputs from the document adapter.
    return element.matches('textarea.inputarea, .native-edit-context')
      ? element.closest('.monaco-editor')
      : null;
  },
  snapshot(root) {
    const carets = Array.from(root.querySelectorAll<HTMLElement>('.cursor, .selected-text'))
      .map(
        (node) => `${node.style.top}:${node.style.left}:${node.style.width}:${node.style.height}`,
      )
      .join('|');
    return (root.querySelector('.view-lines')?.textContent ?? '') + '\u0000' + carets;
  },
  insert: (element, text) =>
    nativeContext(element) ? typeIntoEditContext(element, text) : insertTextarea(element, text),
};
