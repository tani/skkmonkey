import type { EditorAdapter } from '../types.ts';
import { captureTextSelection, stabilizeInsertedCaret } from '../shared/selection.ts';

function isSlackComposer(element: HTMLElement): boolean {
  if (!element.isContentEditable) return false;
  const role = element.getAttribute('role');
  const cls = element.className;
  return (
    role === 'textbox' &&
    typeof cls === 'string' &&
    /(?:ql-editor|c-texty_input|slack|message)/i.test(cls + ' ' + element.outerHTML.slice(0, 300))
  );
}

function textOf(root: HTMLElement): string {
  return root.innerText ?? root.textContent ?? '';
}

function insertSlack(root: HTMLElement, text: string): boolean {
  root.focus();
  const bookmark = captureTextSelection(root);

  // Slack's composer is a React controlled contenteditable. Mutating DOM or
  // dispatching only an input event does not update React state. Use the native
  // beforeinput/input path and let Slack's editor transaction consume it.
  const before = new InputEvent('beforeinput', {
    bubbles: true,
    composed: true,
    cancelable: true,
    inputType: 'insertText',
    data: text,
  });
  if (!root.dispatchEvent(before)) return false;

  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(root.ownerDocument.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  root.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: text,
    }),
  );
  stabilizeInsertedCaret(bookmark, text.length);
  return true;
}

export const adapter: EditorAdapter = {
  kind: 'slack',
  detect(element) {
    if (isSlackComposer(element)) return element;
    const candidate = element.closest('[contenteditable="true"][role="textbox"]');
    return candidate && isSlackComposer(candidate as HTMLElement)
      ? (candidate as HTMLElement)
      : null;
  },
  snapshot(root) {
    return textOf(root);
  },
  insert(element, text) {
    return insertSlack(element, text);
  },
};
