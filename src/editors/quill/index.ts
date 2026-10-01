import type { EditorAdapter } from '../types.ts';
import { legacyInstance, insertLegacy } from './v1.ts';
import { insert as insertModern } from './v2.ts';

export const adapter: EditorAdapter = {
  kind: 'quill',
  detect(element) {
    if (!element.closest('.ql-editor')) return null;
    return element.closest('.ql-container');
  },
  snapshot(root) {
    const surface = root.matches('.ql-editor') ? root : root.querySelector('.ql-editor');
    return (surface?.textContent ?? '') + '\u0000';
  },
  insert: (element, text) =>
    legacyInstance(element) ? insertLegacy(element, text) : insertModern(element, text),
};
