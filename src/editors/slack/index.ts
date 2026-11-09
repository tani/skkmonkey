import type { EditorAdapter } from '../types.ts';
import {
  captureTextSelection,
  currentRange,
  selectionFor,
  stabilizeInsertedCaret,
} from '../shared/selection.ts';

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

// Slack can recreate the inline spans of a Quill line without changing
// the draft or the caret. Count block and embed boundaries as well as text
// so positions on different empty lines or around an embed stay distinct.
export function slackSelectionKey(root: HTMLElement, range: Range): string {
  const prefix = root.ownerDocument.createRange();
  prefix.selectNodeContents(root);
  const lines = Array.from(root.querySelectorAll('p, li, pre, blockquote, h1, h2, h3, h4, h5, h6'));
  const atoms = Array.from(root.querySelectorAll('[contenteditable="false"], img'));
  const offset = (node: Node, index: number): string => {
    prefix.setEnd(node, index);
    const blocks = lines.filter((line) => prefix.comparePoint(line, 0) === 0).length;
    const embeds = atoms.filter((atom) => prefix.comparePoint(atom, 0) === 0).length;
    return `${blocks}:${embeds}:${prefix.toString().length}`;
  };
  return (
    offset(range.startContainer, range.startOffset) +
    '/' +
    offset(range.endContainer, range.endOffset)
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

  const selection = selectionFor(root);
  const range = currentRange(root);
  if (!selection || !range) return false;
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
