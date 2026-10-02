export interface TextSelectionBookmark {
  root: HTMLElement;
  start: number;
  end: number;
  length: number;
}

function offsetAt(root: HTMLElement, node: Node, offset: number): number {
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

export function captureTextSelection(element: HTMLElement): TextSelectionBookmark | null {
  const root = element.isContentEditable
    ? element
    : element.closest<HTMLElement>('[contenteditable]:not([contenteditable="false"])');
  if (!root) return null;
  const selection = root.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  return {
    root,
    start: offsetAt(root, range.startContainer, range.startOffset),
    end: offsetAt(root, range.endContainer, range.endOffset),
    length: root.textContent?.length ?? 0,
  };
}

function pointAt(root: HTMLElement, offset: number): [Node, number] | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) return [node, remaining];
    remaining -= length;
  }
  return offset === 0 ? [root, 0] : null;
}

function currentOffset(root: HTMLElement): number | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return null;
  return offsetAt(root, range.startContainer, range.startOffset);
}

export function stabilizeInsertedCaret(
  bookmark: TextSelectionBookmark | null,
  insertedLength: number,
): void {
  if (!bookmark) return;
  const { root } = bookmark;
  const target = bookmark.start + insertedLength;
  const expectedLength = bookmark.length - (bookmark.end - bookmark.start) + insertedLength;
  const restore = (): void => {
    if (!root.isConnected) return;
    const current = currentOffset(root);
    const length = root.textContent?.length ?? 0;
    // A later SKK commit or page edit supersedes this scheduled recovery.
    if (length !== expectedLength) return;
    // Preserve a correct selection and never override an intentional move.
    // The recovery is only for the observed component failure mode: a
    // transaction inserts at the right place but DOM selection snaps to EOF.
    if (current === target || current !== length || target === length) return;
    const point = pointAt(root, target);
    if (!point) return;
    const range = root.ownerDocument.createRange();
    range.setStart(point[0], point[1]);
    range.collapse(true);
    const selection = root.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    root.ownerDocument.dispatchEvent(new Event('selectionchange'));
  };
  restore();
  requestAnimationFrame(restore);
}
