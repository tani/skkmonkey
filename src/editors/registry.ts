import type { Component, EditorAdapter } from './types.ts';
import { adapter as monaco } from './monaco/index.ts';
import { adapter as codemirror5 } from './codemirror5/index.ts';
import { adapter as codemirror6 } from './codemirror6/index.ts';
import { adapter as tiptap } from './tiptap/index.ts';
import { adapter as prosemirror } from './prosemirror/index.ts';
import { adapter as quill } from './quill/index.ts';

// Specific wrappers precede their generic underlying editor. Selection is by
// input capabilities/DOM, never an assumed globally accessible version string.
export const adapters: readonly EditorAdapter[] = [
  monaco,
  codemirror5,
  codemirror6,
  tiptap,
  prosemirror,
  quill,
];
export function componentFor(element: HTMLElement): Component | null {
  for (const adapter of adapters) {
    const root = adapter.detect(element);
    if (root) return { kind: adapter.kind, root, adapter };
  }
  return null;
}
export function componentSnapshot(element: HTMLElement): string {
  const component = componentFor(element);
  return component ? component.adapter.snapshot(component.root) : '';
}
