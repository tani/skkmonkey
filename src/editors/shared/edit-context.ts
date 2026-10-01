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
