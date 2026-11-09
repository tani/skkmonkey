import { componentFor } from './component.ts';
import { currentRange } from './editors/shared/selection.ts';

const textStyle = [
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-variant',
  'font-stretch',
  'font-feature-settings',
  'font-kerning',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'tab-size',
  'text-transform',
] as const;

function copyStyle(
  target: HTMLElement,
  source: CSSStyleDeclaration,
  properties: readonly string[],
): void {
  for (const property of properties)
    target.style.setProperty(property, source.getPropertyValue(property));
}

function pixels(value: string): number {
  return parseFloat(value) || 0;
}

function lineHeight(style: CSSStyleDeclaration): number {
  return pixels(style.lineHeight) || pixels(style.fontSize) * 1.2;
}

function backgroundAt(element: HTMLElement, style: CSSStyleDeclaration): string {
  let parent: HTMLElement | null = element;
  let background = style.backgroundColor;
  while (parent && (background === 'transparent' || background === 'rgba(0, 0, 0, 0)')) {
    parent = parent.parentElement;
    if (parent) background = getComputedStyle(parent).backgroundColor;
  }
  return parent ? background : 'Canvas';
}

export class InlinePreedit {
  readonly element = document.createElement('span');
  private readonly mirror = document.createElement('div');
  private readonly marker = document.createElement('span');
  private frame: number | undefined;
  private editor: HTMLElement | null = null;
  private text = '';

  constructor(root: ShadowRoot) {
    this.element.className = 'inline-preedit';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.mirror.className = 'inline-preedit-mirror';
    this.mirror.setAttribute('aria-hidden', 'true');
    root.append(this.element, this.mirror);
  }

  render(editor: HTMLElement | null, text = ''): void {
    this.editor = editor;
    this.text = text;
    if (!editor || !text) {
      if (this.frame !== undefined) cancelAnimationFrame(this.frame);
      this.frame = undefined;
      this.element.hidden = true;
      this.element.textContent = '';
      return;
    }
    // Resolve geometry at paint time. Multiple keys in one frame only need
    // one measurement, and a completed syllable cancels that measurement.
    this.frame ??= requestAnimationFrame(() => {
      this.frame = undefined;
      this.position();
    });
  }

  private fieldCaret(
    field: HTMLInputElement | HTMLTextAreaElement,
    bounds: DOMRect,
    style: CSSStyleDeclaration,
  ): DOMRect {
    const input = field instanceof HTMLInputElement;
    const index =
      field.selectionDirection === 'backward' ? field.selectionStart : field.selectionEnd;
    const offset = index ?? 0;
    const mirror = this.mirror;
    copyStyle(mirror, style, [
      ...textStyle,
      'direction',
      'text-align',
      'text-indent',
      'padding',
      'border-width',
    ]);
    mirror.style.width =
      field.clientWidth + pixels(style.borderLeftWidth) + pixels(style.borderRightWidth) + 'px';
    mirror.style.whiteSpace = input || field.wrap === 'off' ? 'pre' : 'pre-wrap';
    mirror.style.overflowWrap = input || field.wrap === 'off' ? 'normal' : 'break-word';
    this.marker.textContent = field.value.slice(offset) || '\u200b';
    mirror.replaceChildren(field.value.slice(0, offset), this.marker);
    const point = document.createRange();
    point.setStart(this.marker.firstChild!, 0);
    point.collapse(true);
    const caret = point.getBoundingClientRect();
    const origin = mirror.getBoundingClientRect();
    const height = lineHeight(style);
    const top = input
      ? bounds.top + (bounds.height - height) / 2
      : bounds.top + caret.top - origin.top - field.scrollTop;
    const left = bounds.left + caret.left - origin.left - field.scrollLeft;
    mirror.replaceChildren();
    return new DOMRect(left, top, 0, height);
  }

  private position(): void {
    const editor = this.editor;
    if (!editor?.isConnected) {
      this.element.hidden = true;
      return;
    }
    const component = componentFor(editor);
    const root = component?.root ?? editor;
    const cursorSelector =
      component?.kind === 'monaco'
        ? '.cursors-layer .cursor'
        : component?.kind === 'codemirror5'
          ? '.CodeMirror-cursor'
          : component?.kind === 'codemirror6'
            ? '.cm-cursor-primary'
            : null;
    const cursor = cursorSelector ? root.querySelector<HTMLElement>(cursorSelector) : null;
    const visibleCursor = cursor?.getBoundingClientRect();
    const componentCaret = visibleCursor?.height ? visibleCursor : null;
    const range = currentRange(editor)?.cloneRange();
    range?.collapse(false);
    const node = range?.startContainer;
    const surface = componentCaret
      ? (root.querySelector<HTMLElement>('.view-lines, .CodeMirror-code, .cm-content') ?? root)
      : node instanceof HTMLElement
        ? node
        : (node?.parentElement ?? editor);
    const style = getComputedStyle(surface);
    const bounds = root.getBoundingClientRect();
    const field = editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement;
    let caret =
      componentCaret ??
      (field
        ? this.fieldCaret(editor, editor.getBoundingClientRect(), style)
        : range?.getBoundingClientRect());
    if (!caret?.height) {
      const rect = surface.getBoundingClientRect();
      const left =
        style.direction === 'rtl'
          ? rect.right - pixels(style.paddingRight) - pixels(style.borderRightWidth)
          : rect.left + pixels(style.paddingLeft) + pixels(style.borderLeftWidth);
      caret = new DOMRect(
        left,
        rect.top + pixels(style.paddingTop) + pixels(style.borderTopWidth),
        0,
        lineHeight(style),
      );
    }
    if (
      !bounds.width ||
      !bounds.height ||
      caret.bottom <= bounds.top ||
      caret.top >= bounds.bottom
    ) {
      this.element.hidden = true;
      return;
    }
    const preview = this.element;
    copyStyle(preview, style, textStyle);
    preview.style.color = style.color;
    preview.style.backgroundColor = backgroundAt(surface, style);
    preview.style.colorScheme = style.colorScheme;
    preview.style.lineHeight = caret.height + 'px';
    preview.textContent = this.text;
    preview.hidden = false;
    const width = preview.offsetWidth;
    const left = caret.left - (style.direction === 'rtl' ? width : 0);
    preview.style.left = Math.max(bounds.left, Math.min(left, bounds.right - width)) + 'px';
    preview.style.top = Math.max(bounds.top, caret.top) + 'px';
  }
}
