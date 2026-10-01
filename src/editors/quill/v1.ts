interface Delta {
  retain(length: number): Delta;
  delete(length: number): Delta;
  insert(text: string, formats?: Record<string, unknown>): Delta;
}
interface Quill1 {
  root: HTMLElement;
  isEnabled(): boolean;
  getSelection(focus?: boolean): { index: number; length: number } | null;
  getContents(index: number, length: number): Delta;
  getFormat(index: number): Record<string, unknown>;
  updateContents(delta: Delta, source: string): void;
  setSelection(index: number, length: number, source: string): void;
  history: { cutoff(): void };
}
export function legacyInstance(element: HTMLElement): Quill1 | null {
  const root = element.closest<HTMLElement>('.ql-container');
  const instance = (root as (HTMLElement & { __quill?: Quill1 }) | null)?.__quill;
  return instance?.root === element &&
    typeof instance.updateContents === 'function' &&
    typeof instance.getContents === 'function' &&
    typeof instance.history?.cutoff === 'function'
    ? instance
    : null;
}
export function insertLegacy(element: HTMLElement, text: string): boolean {
  const quill = legacyInstance(element);
  if (!quill?.isEnabled()) return false;
  const range = quill.getSelection();
  if (!range) return false;
  // Quill 1's paste handler focuses an offscreen clipboard and waits for a
  // real browser paste. Synthetic clipboard events cannot supply that default
  // action. Use its container instance hook (the same hook as Quill.find),
  // confined to this compatibility module, and a single user Delta transaction.
  quill.history.cutoff();
  const delta = quill
    .getContents(0, 0)
    .retain(range.index)
    .delete(range.length)
    .insert(text, quill.getFormat(range.index));
  quill.updateContents(delta, 'user');
  quill.setSelection(range.index + text.length, 0, 'silent');
  quill.history.cutoff();
  return true;
}
