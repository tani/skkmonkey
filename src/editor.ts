import { componentFor, componentSnapshot, nativeContext } from './component.ts';
import { insertInput } from './editors/native/input.ts';
import { insertContenteditable } from './editors/native/contenteditable.ts';
import type { Editor } from './editors/types.ts';
export type { Editor } from './editors/types.ts';
export { findEditor } from './editors/native/index.ts';

function selectionFor(editor: Editor): Selection | null {
  const root = editor.getRootNode() as
    | Document
    | (ShadowRoot & { getSelection?: () => Selection | null });
  return 'getSelection' in root && root.getSelection
    ? root.getSelection()
    : document.getSelection();
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
      this.value = context.text;
      this.start = context.selectionStart;
      this.end = context.selectionEnd;
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
    if (context)
      return (
        context.text === this.value &&
        context.selectionStart === this.start &&
        context.selectionEnd === this.end
      );
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      return (
        !editor.disabled &&
        !editor.readOnly &&
        editor.value === this.value &&
        editor.selectionStart === this.start &&
        editor.selectionEnd === this.end
      );
    }
    if (!editor.isContentEditable || (editor.textContent ?? '') !== this.value || !this.range)
      return false;
    const selection = selectionFor(editor);
    if (!selection?.rangeCount) return false;
    const current = selection.getRangeAt(0);
    return (
      current.startContainer === this.range.startContainer &&
      current.startOffset === this.range.startOffset &&
      current.endContainer === this.range.endContainer &&
      current.endOffset === this.range.endOffset
    );
  }
  restoreFocus(): boolean {
    const editor = this.editor;
    if (!editor.isConnected) return false;
    const component = componentFor(editor);
    if (
      component &&
      componentSnapshot(editor).split('\u0000')[0] !== this.componentState.split('\u0000')[0]
    )
      return false;
    const context = nativeContext(editor);
    if (context) {
      if (context.text !== this.value) return false;
      editor.focus();
      context.updateSelection(this.start, this.end);
      return true;
    }
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      if (editor.disabled || editor.readOnly || (!component && editor.value !== this.value))
        return false;
      editor.focus();
      editor.setSelectionRange(this.start, this.end);
      return true;
    }
    if (
      !editor.isContentEditable ||
      editor.textContent !== this.value ||
      !this.range?.startContainer.isConnected ||
      !this.range.endContainer.isConnected
    )
      return false;
    editor.focus();
    const selection = selectionFor(editor);
    selection?.removeAllRanges();
    selection?.addRange(this.range.cloneRange());
    editor.ownerDocument.dispatchEvent(new Event('selectionchange'));
    return true;
  }
  insert(text: string): boolean {
    if (!this.valid()) return false;
    if (!text) return true;
    const editor = this.editor;
    // Component editors own their input transaction. Sending a generic
    // beforeinput first and then an adapter-specific paste/EditContext event
    // gives one SKK commit two competing insertion protocols and can move the
    // component's model selection between consecutive kana commits.
    const component = componentFor(editor);
    if (component) return component.adapter.insert(editor, text);

    // Native fields use the standard beforeinput contract before mutation.
    const before = new InputEvent('beforeinput', {
      bubbles: true,
      composed: true,
      cancelable: true,
      inputType: 'insertText',
      data: text,
    });
    if (!editor.dispatchEvent(before) || !this.valid()) return false;
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement)
      return insertInput(editor, text);
    return insertContenteditable(editor, text, this.range!, selectionFor(editor));
  }
}
