import { nativeContext } from '../shared/edit-context.ts';
export function insertEditContext(element: HTMLElement, text: string): boolean {
  const context = nativeContext(element);
  if (!context) return false;
  const start = context.selectionStart,
    end = context.selectionEnd;
  // Model native typing, including the browser's buffer update before the
  // textupdate notification. Older CM6 EditContext handlers depend on this.
  context.dispatchEvent(new Event('compositionstart'));
  try {
    context.updateText(start, end, text);
    context.updateSelection(start + text.length, start + text.length);
    const event = new Event('textupdate');
    Object.defineProperties(event, {
      text: { value: text },
      updateRangeStart: { value: start },
      updateRangeEnd: { value: end },
      selectionStart: { value: start + text.length },
      selectionEnd: { value: start + text.length },
    });
    context.dispatchEvent(event);
  } finally {
    context.dispatchEvent(new Event('compositionend'));
  }
  return true;
}
