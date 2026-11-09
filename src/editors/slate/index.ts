import type { EditorAdapter, PendingInsertion } from '../types.ts';
import { currentRange } from '../shared/selection.ts';

const rootSelector = '[data-slate-editor="true"][contenteditable]';
const ignored = '[data-slate-placeholder], [data-slate-zero-width]';
const block = '[data-slate-node="element"]:not([data-slate-inline]), [data-slate-object="block"]';

function draftText(content: DocumentFragment): string {
  for (const element of content.querySelectorAll(ignored)) element.remove();
  // Keep distinct block positions even when two blocks contain no text.
  for (const element of content.querySelectorAll(block)) element.prepend('\n');
  return content.textContent ?? '';
}

function contents(root: HTMLElement): Range {
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);
  return range;
}

function offsetAt(root: HTMLElement, node: Node, offset: number): number {
  const prefix = contents(root);
  prefix.setEnd(node, offset);
  return draftText(prefix.cloneContents()).length;
}

function insert(root: HTMLElement, text: string): false | PendingInsertion {
  const range = currentRange(root);
  if (!range) return false;
  const before = draftText(contents(root).cloneContents());
  const start = offsetAt(root, range.startContainer, range.startOffset);
  const end = offsetAt(root, range.endContainer, range.endOffset);
  const expected = before.slice(0, start) + text + before.slice(end);
  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', text);
  const event = new InputEvent('beforeinput', {
    bubbles: true,
    composed: true,
    cancelable: true,
    inputType: 'insertFromPaste',
    dataTransfer,
    targetRanges: [new StaticRange(range)],
  });
  root.dispatchEvent(event);
  if (!event.defaultPrevented) return false;

  // Slate has claimed the event. The model, DOM and selection may update at
  // different times. Only the expected DOM edit and caret confirm completion.
  return {
    applied() {
      const current = currentRange(root);
      return (
        root.isConnected &&
        current?.collapsed === true &&
        draftText(contents(root).cloneContents()) === expected &&
        offsetAt(root, current.startContainer, current.startOffset) === start + text.length
      );
    },
  };
}

export const adapter: EditorAdapter = {
  kind: 'slate',
  detect(element) {
    const root = element.closest<HTMLElement>(rootSelector);
    return root?.isContentEditable ? root : null;
  },
  snapshot: (root) => draftText(contents(root).cloneContents()),
  insert,
};
