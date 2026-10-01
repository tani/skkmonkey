import type { EditorAdapter } from '../types.ts';
import { nativeContext } from '../shared/edit-context.ts';
import { insertEditContext } from './edit-context.ts';
import { insert as insertContent } from './contenteditable.ts';

export const adapter: EditorAdapter = {
  kind: 'codemirror6',
  detect(element) {
    if (!element.closest('.cm-content')) return null;
    return element.closest('.cm-editor');
  },
  snapshot(root) {
    const surface = root.matches('.cm-content') ? root : root.querySelector('.cm-content');
    return (surface?.textContent ?? '') + '\u0000';
  },
  insert: (element, text) =>
    nativeContext(element) ? insertEditContext(element, text) : insertContent(element, text),
};
