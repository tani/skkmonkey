import { componentFor, componentSnapshot, nativeContext } from './component.ts';
import { insertInput } from './editors/native/input.ts';
import { insertContenteditable } from './editors/native/contenteditable.ts';
import { currentRange, selectionFor } from './editors/shared/selection.ts';
import type { Editor, PendingInsertion } from './editors/types.ts';
export type { Editor } from './editors/types.ts';
export { findEditor } from './editors/native/index.ts';

interface Boundary {
  path: number[];
  offset: number;
  nodeType: number;
  textOffset: number;
}

function textOffsetAt(root: HTMLElement, node: Node, offset: number): number {
  const prefix = root.ownerDocument.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(node, offset);
  return prefix.toString().length;
}

function captureBoundary(root: HTMLElement, node: Node, offset: number): Boundary {
  const path: number[] = [];
  const { nodeType } = node;
  const textOffset = textOffsetAt(root, node, offset);
  while (node !== root) {
    const parent = node.parentNode!;
    path.push(Array.from(parent.childNodes).indexOf(node as ChildNode));
    node = parent;
  }
  return { path: path.reverse(), offset, nodeType, textOffset };
}

function resolveBoundary(root: HTMLElement, boundary: Boundary): Node | null {
  let node: Node = root;
  for (const index of boundary.path) {
    const child = node.childNodes[index];
    if (!child) return null;
    node = child;
  }
  // Splitting adjacent text nodes can change offsets without changing innerHTML.
  const length = node instanceof CharacterData ? node.length : node.childNodes.length;
  if (node.nodeType !== boundary.nodeType || boundary.offset > length) return null;
  return textOffsetAt(root, node, boundary.offset) === boundary.textOffset ? node : null;
}

// A bookmark guards against asynchronous page edits or caret moves. Pending
// preedit is outside the page; stale bookmarks must never overwrite user text.
export class Bookmark {
  private value: string;
  private start = 0;
  private end = 0;
  private contentSelection: { start: Boundary; end: Boundary } | null = null;
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
      // Keep an immutable position. A live Range moves when a host replaces
      // its DOM nodes, even if the host restores the same logical caret.
      this.value = editor.innerHTML;
      const range = currentRange(editor);
      if (range) {
        this.contentSelection = {
          start: captureBoundary(editor, range.startContainer, range.startOffset),
          end: captureBoundary(editor, range.endContainer, range.endOffset),
        };
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
    const saved = this.contentSelection;
    if (!editor.isContentEditable || !saved || editor.innerHTML !== this.value) return false;
    const current = currentRange(editor);
    return (
      current !== null &&
      current.startContainer === resolveBoundary(editor, saved.start) &&
      current.startOffset === saved.start.offset &&
      current.endContainer === resolveBoundary(editor, saved.end) &&
      current.endOffset === saved.end.offset
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
    const saved = this.contentSelection;
    if (!editor.isContentEditable || !saved || editor.innerHTML !== this.value) return false;
    editor.focus();
    if (editor.innerHTML !== this.value) return false;
    const start = resolveBoundary(editor, saved.start);
    const end = resolveBoundary(editor, saved.end);
    if (!start || !end) return false;
    const range = editor.ownerDocument.createRange();
    range.setStart(start, saved.start.offset);
    range.setEnd(end, saved.end.offset);
    const selection = selectionFor(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.ownerDocument.dispatchEvent(new Event('selectionchange'));
    return true;
  }
  insert(text: string): boolean | PendingInsertion {
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
    const range = currentRange(editor);
    return range ? insertContenteditable(editor, text, range, selectionFor(editor)) : false;
  }
}
