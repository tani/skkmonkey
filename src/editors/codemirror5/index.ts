import type { EditorAdapter } from '../types.ts';
import { insert as insertContent } from './textarea.ts';

export const adapter: EditorAdapter = {
  kind: 'codemirror5',
  detect(element) {
    if (
      !(element.matches('textarea') && !element.closest('.CodeMirror-dialog')) &&
      !element.closest('.CodeMirror-code')
    )
      return null;
    return element.closest('.CodeMirror');
  },
  snapshot(root) {
    const surface = root.matches('.CodeMirror-code')
      ? root
      : root.querySelector('.CodeMirror-code');
    return (surface?.textContent ?? '') + '\u0000';
  },
  insert: insertContent,
};
