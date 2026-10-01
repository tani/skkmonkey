import { componentFor, componentSnapshot, nativeContext, pasteIntoComponent, typeIntoEditContext } from './component.ts';

export type Editor = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

export function findEditor(path: EventTarget[]): Editor | null {
  if (path.some(item => item instanceof HTMLElement && item.matches('[data-skk-disable]'))) return null;
  for (const item of path) {
    if (!(item instanceof HTMLElement)) continue;
    if (item.closest('[data-skk-disable]')) return null;
    if (componentFor(item)?.kind === 'monaco' && item.getAttribute('aria-autocomplete') === 'none') return null;
    if (item instanceof HTMLTextAreaElement) return item.disabled || item.readOnly ? null : item;
    if (item instanceof HTMLInputElement) return (
      ['text', 'search'].includes(item.type) && !item.disabled && !item.readOnly ? item : null);
    if (item.closest('[contenteditable="false"]')) return null;
    if (nativeContext(item) && componentFor(item)?.kind === 'monaco') return item;
    if (item.isContentEditable) {
      let root = item;
      while (root.parentElement?.isContentEditable) root = root.parentElement;
      return root;
    }
  }
  return null;
}

function selectionFor(editor: Editor): Selection | null {
  const root = editor.getRootNode() as Document | (ShadowRoot & { getSelection?: () => Selection | null });
  return 'getSelection' in root && root.getSelection ? root.getSelection() : document.getSelection();
}

// A bookmark guards against asynchronous page edits or caret moves. Pending
// preedit is outside the page; stale bookmarks must never overwrite user text.
export class Bookmark {
  private value: string;
  private start = 0;
  private end = 0;
  private range: Range | null = null;
  private componentState: string;
  readonly editor: Editor;
  constructor(editor: Editor) {
    this.editor = editor;
    this.componentState = componentSnapshot(editor);
    const context = nativeContext(editor);
    if (context) {
      this.value = context.text; this.start = context.selectionStart; this.end = context.selectionEnd;
    } else if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      this.value = editor.value;
      this.start = editor.selectionStart ?? 0;
      this.end = editor.selectionEnd ?? this.start;
    } else {
      this.value = editor.textContent ?? '';
      const selection = selectionFor(editor);
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (editor.contains(range.commonAncestorContainer)) this.range = range.cloneRange();
      }
    }
  }
  valid(): boolean {
    const editor = this.editor;
    if (!editor.isConnected) return false;
    if (componentSnapshot(editor) !== this.componentState) return false;
    const context = nativeContext(editor);
    if (context) return context.text === this.value && context.selectionStart === this.start && context.selectionEnd === this.end;
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      return !editor.disabled && !editor.readOnly && editor.value === this.value &&
        editor.selectionStart === this.start && editor.selectionEnd === this.end;
    }
    if (!editor.isContentEditable || (editor.textContent ?? '') !== this.value || !this.range) return false;
    const selection = selectionFor(editor);
    if (!selection?.rangeCount) return false;
    const current = selection.getRangeAt(0);
    return current.startContainer === this.range.startContainer && current.startOffset === this.range.startOffset &&
      current.endContainer === this.range.endContainer && current.endOffset === this.range.endOffset;
  }
  restoreFocus(): boolean {
    const editor = this.editor;
    if (!editor.isConnected) return false;
    const component = componentFor(editor);
    if (component && componentSnapshot(editor).split('\u0000')[0] !== this.componentState.split('\u0000')[0]) return false;
    const context = nativeContext(editor);
    if (context) {
      if (context.text !== this.value) return false;
      editor.focus(); context.updateSelection(this.start, this.end); return true;
    }
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      if (editor.disabled || editor.readOnly || (!component && editor.value !== this.value)) return false;
      editor.focus(); editor.setSelectionRange(this.start, this.end); return true;
    }
    if (!editor.isContentEditable || editor.textContent !== this.value || !this.range?.startContainer.isConnected || !this.range.endContainer.isConnected) return false;
    editor.focus();
    const selection = selectionFor(editor);
    selection?.removeAllRanges(); selection?.addRange(this.range.cloneRange());
    editor.ownerDocument.dispatchEvent(new Event('selectionchange'));
    return true;
  }
  insert(text: string): boolean {
    if (!this.valid()) return false;
    if (!text) return true;
    const editor = this.editor;
    // Sites can veto insertion via the standard cancelable beforeinput event.
    const before = new InputEvent('beforeinput', { bubbles: true, composed: true,
      cancelable: true, inputType: 'insertText', data: text });
    if (!editor.dispatchEvent(before) || !this.valid()) return false;
    const component = componentFor(editor);
    if (component?.kind === 'monaco' && nativeContext(editor)) return typeIntoEditContext(editor, text);
    if (component && component.kind !== 'monaco') return pasteIntoComponent(editor, text);
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      const next = this.value.slice(0, this.start) + text + this.value.slice(this.end);
      // Use the native setter so controlled frameworks notice the input event.
      const proto = editor instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(editor, next);
      editor.setSelectionRange(this.start + text.length, this.start + text.length);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
      return true;
    }
    const selection = selectionFor(editor);
    selection?.removeAllRanges(); selection?.addRange(this.range!);
    // Chromium and Firefox retain contenteditable undo history with insertText.
    // No HTML is inserted, even if a dictionary candidate contains markup.
    if (document.execCommand('insertText', false, text)) return true;
    const range = this.range!;
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node); range.setStartAfter(node); range.collapse(true);
    selection?.removeAllRanges(); selection?.addRange(range);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
    return true;
  }
}
