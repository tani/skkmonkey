import type { EditorAdapter } from '../types.ts';
import { adapter as prosemirror } from '../prosemirror/index.ts';

// Tiptap shares ProseMirror transactions, but keeps a distinct registry entry.
export const adapter: EditorAdapter = {
  ...prosemirror, kind: 'tiptap',
  detect: element => element.closest<HTMLElement>('.tiptap.ProseMirror'),
};
