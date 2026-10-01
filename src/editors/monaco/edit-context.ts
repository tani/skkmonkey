import { nativeContext } from '../shared/edit-context.ts';

export function typeIntoEditContext(element: HTMLElement, text: string): boolean {
  const context = nativeContext(element);
  if (!context) return false;
  // A short composition transaction synchronizes Monaco's deferred native
  // buffer with its model before and after insertion. Only public EditContext
  // events/methods are used; no page-global Monaco instance is required.
  // Capture and restore the original method; it is called with context below.
  // oxlint-disable-next-line typescript/unbound-method
  const updateText = context.updateText;
  context.updateText = function (start, end, value) {
    // Monaco echoes the entire primary-selection buffer from offset zero.
    // Replace its actual length, including any browser-applied native text,
    // so that the echo cannot append a second copy of the inserted text.
    updateText.call(this, start, start === 0 ? this.text.length : end, value);
  };
  let end = context.selectionStart;
  try {
    context.dispatchEvent(new Event('compositionstart'));
    const start = context.selectionStart;
    end = start + text.length;
    const event = new Event('textupdate');
    Object.defineProperties(event, {
      text: { value: text },
      updateRangeStart: { value: start },
      updateRangeEnd: { value: context.selectionEnd },
      selectionStart: { value: end },
      selectionEnd: { value: end },
    });
    context.dispatchEvent(event);
  } finally {
    try {
      context.dispatchEvent(new Event('compositionend'));
      context.updateSelection(end, end);
    } finally {
      context.updateText = updateText;
    }
  }
  return true;
}
