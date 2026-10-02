import { captureTextSelection, stabilizeInsertedCaret } from './selection.ts';

export function pasteIntoComponent(element: HTMLElement, text: string): boolean {
  const selection = captureTextSelection(element);
  // A native arrow key can move the browser selection before the editor's
  // queued selectionchange callback runs. Flush that public notification so
  // paste operates on the user's current selection rather than the old model.
  element.ownerDocument.dispatchEvent(new Event('selectionchange'));
  const data = new DataTransfer();
  data.setData('text/plain', text);
  const paste = new ClipboardEvent('paste', { bubbles: true, composed: true, cancelable: true });
  // Firefox protects constructor-supplied clipboard data during dispatch.
  // Attach our local plaintext transfer to this explicitly synthetic event;
  // no system clipboard contents are accessed or changed.
  Object.defineProperty(paste, 'clipboardData', { value: data });
  element.dispatchEvent(paste);
  if (paste.defaultPrevented) stabilizeInsertedCaret(selection, text.length);
  // Supported editors synchronously prevent default and apply the clipboard
  // data through their own paste handler. If declined, fail closed: no DOM hack.
  return paste.defaultPrevented;
}
