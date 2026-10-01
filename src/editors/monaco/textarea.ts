import { insertInput } from '../native/input.ts';
export function insertTextarea(element: HTMLElement, text: string): boolean {
  return element instanceof HTMLTextAreaElement && insertInput(element, text);
}
