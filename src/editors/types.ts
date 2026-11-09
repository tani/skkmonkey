export type Editor = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
export type ComponentKind =
  | 'monaco'
  | 'codemirror5'
  | 'codemirror6'
  | 'prosemirror'
  | 'tiptap'
  | 'quill'
  | 'slack'
  | 'slate';
export interface PendingInsertion {
  applied(): boolean;
}
export interface EditorAdapter {
  readonly kind: ComponentKind;
  detect(element: HTMLElement): HTMLElement | null;
  snapshot(root: HTMLElement): string;
  insert(element: HTMLElement, text: string): boolean | PendingInsertion;
}
export interface Component {
  kind: ComponentKind;
  root: HTMLElement;
  adapter: EditorAdapter;
}
