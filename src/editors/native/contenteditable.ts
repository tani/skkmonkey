export function insertContenteditable(editor: HTMLElement, text: string, range: Range, selection: Selection | null): boolean {
  selection?.removeAllRanges(); selection?.addRange(range);
  // insertText preserves native rich-text undo; dictionary text is never HTML.
  if (document.execCommand('insertText', false, text)) return true;
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node); range.setStartAfter(node); range.collapse(true);
  selection?.removeAllRanges(); selection?.addRange(range);
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  return true;
}
