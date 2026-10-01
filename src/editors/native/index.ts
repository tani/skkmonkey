import { componentFor } from '../registry.ts';
import { nativeContext } from '../shared/edit-context.ts';
import type { Editor } from '../types.ts';

export function findEditor(path: EventTarget[]): Editor | null {
  if (path.some((item) => item instanceof HTMLElement && item.matches('[data-skk-disable]')))
    return null;
  for (const item of path) {
    if (!(item instanceof HTMLElement)) continue;
    if (item.closest('[data-skk-disable]')) return null;
    if (componentFor(item)?.kind === 'monaco' && item.getAttribute('aria-autocomplete') === 'none')
      return null;
    if (item instanceof HTMLTextAreaElement) return item.disabled || item.readOnly ? null : item;
    if (item instanceof HTMLInputElement)
      return ['text', 'search'].includes(item.type) && !item.disabled && !item.readOnly
        ? item
        : null;
    if (item.closest('[contenteditable="false"]')) return null;
    if (nativeContext(item) && componentFor(item)?.kind === 'monaco') return item;
    if (item.isContentEditable) {
      let root = item;
      while (root.parentElement?.isContentEditable) root = root.parentElement;
      return root;
    }
  }
  return null;
}
