export function insertInput(editor: HTMLInputElement | HTMLTextAreaElement, text: string): boolean {
  const start = editor.selectionStart ?? 0;
  const end = editor.selectionEnd ?? start;
  const next = editor.value.slice(0, start) + text + editor.value.slice(end);
  // Native setters preserve controlled-framework input tracking.
  const proto = editor instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(editor, next);
  editor.setSelectionRange(start + text.length, start + text.length);
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  return true;
}
