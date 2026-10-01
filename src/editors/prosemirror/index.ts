import type { EditorAdapter } from '../types.ts';
import { insert as insertContent } from './contenteditable.ts';

export const adapter: EditorAdapter = {
  kind: 'prosemirror',
  detect(element) {

    return element.closest('.ProseMirror');
  },
  snapshot(root) {
    const surface = root.matches('.ProseMirror') ? root : root.querySelector('.ProseMirror');
    return (surface?.textContent ?? '') + '\u0000';
  },
  insert: insertContent,
};
