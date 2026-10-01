// Model-driven editors consume plaintext clipboard events and update their own
// transaction/history model. Never edit their rendered DOM as ordinary text.
export type ComponentKind = 'monaco' | 'codemirror5' | 'codemirror6' | 'prosemirror' | 'quill';
export interface Component { kind: ComponentKind; root: HTMLElement }

export function componentFor(element: HTMLElement): Component | null {
  const selectors: readonly [ComponentKind, string][] = [
    ['monaco', '.monaco-editor'], ['codemirror5', '.CodeMirror'],
    ['codemirror6', '.cm-editor'], ['prosemirror', '.ProseMirror'],
    ['quill', '.ql-container'],
  ];
  for (const [kind, selector] of selectors) {
    const root = element.closest<HTMLElement>(selector);
    if (!root) continue;
    // Search boxes, toolbars, and widget inputs inside an editor are ordinary
    // fields, not that editor's document input surface.
    if (kind === 'monaco' && !element.matches('textarea.inputarea, .native-edit-context')) continue;
    if (kind === 'codemirror5' && !(element.matches('textarea') && !element.closest('.CodeMirror-dialog')) && !element.closest('.CodeMirror-code')) continue;
    if (kind === 'codemirror6' && !element.closest('.cm-content')) continue;
    if (kind === 'quill' && !element.closest('.ql-editor')) continue;
    return { kind, root };
  }
  return null;
}

export interface NativeEditContext extends EventTarget {
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  updateText(start: number, end: number, text: string): void;
  updateSelection(start: number, end: number): void;
}

export function nativeContext(element: HTMLElement): NativeEditContext | null {
  const context = (element as HTMLElement & { editContext?: NativeEditContext | null }).editContext;
  return context && typeof context.text === 'string' ? context : null;
}

export function componentSnapshot(element: HTMLElement): string {
  const component = componentFor(element);
  if (!component) return '';
  const selectors = { monaco: '.view-lines', codemirror5: '.CodeMirror-code',
    codemirror6: '.cm-content', prosemirror: '.ProseMirror', quill: '.ql-editor' };
  const surface = component.root.matches(selectors[component.kind]) ? component.root : component.root.querySelector(selectors[component.kind]);
  const carets = component.kind === 'monaco' ? Array.from(component.root.querySelectorAll<HTMLElement>('.cursor, .selected-text'))
    .map(node => `${node.style.top}:${node.style.left}:${node.style.width}:${node.style.height}`).join('|') : '';
  return (surface?.textContent ?? '') + '\u0000' + carets;
}

export function pasteIntoComponent(element: HTMLElement, text: string): boolean {
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
  // Supported editors synchronously prevent default and apply the clipboard
  // data through their own paste handler. If declined, fail closed: no DOM hack.
  return paste.defaultPrevented;
}

export function typeIntoEditContext(element: HTMLElement, text: string): boolean {
  const context = nativeContext(element);
  if (!context) return false;
  // A short composition transaction synchronizes Monaco's deferred native
  // buffer with its model before and after insertion. Only public EditContext
  // events/methods are used; no page-global Monaco instance is required.
  const updateText = context.updateText;
  context.updateText = function(start, end, value) {
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
      text: { value: text }, updateRangeStart: { value: start }, updateRangeEnd: { value: context.selectionEnd },
      selectionStart: { value: end }, selectionEnd: { value: end },
    });
    context.dispatchEvent(event);
  } finally {
    try { context.dispatchEvent(new Event('compositionend')); context.updateSelection(end, end); }
    finally { context.updateText = updateText; }
  }
  return true;
}
