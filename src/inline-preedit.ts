import { componentFor } from './component.ts';
import { selectionFor } from './editors/shared/selection.ts';

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

function richCaret(editor: HTMLElement): { rect: DOMRect; surface: HTMLElement } | null {
  const selection = selectionFor(editor);
  const node = selection?.focusNode;
  if (!selection || !node || !editor.contains(node)) return null;
  const offset = selection.focusOffset;
  const range = editor.ownerDocument.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  const surface = node instanceof HTMLElement ? node : (node.parentElement ?? editor);
  if (rect.height) return { rect, surface };

  // A caret at an element boundary can have an empty Range rect. In
  // particular, a Quill composer can place it between paragraph nodes.
  const next = node.childNodes[offset];
  const adjacent = next ?? node.childNodes[offset - 1];
  let edge = adjacent;
  while (edge?.hasChildNodes()) edge = next ? edge.firstChild! : edge.lastChild!;
  if (edge instanceof Text) {
    range.setStart(edge, next ? 0 : edge.length);
    range.collapse(true);
    const measured = range.getBoundingClientRect();
    if (measured.height) return { rect: measured, surface: edge.parentElement ?? surface };
  }
  const line = edge?.parentElement ?? surface;
  const style = getComputedStyle(line);
  const bounds = line.getBoundingClientRect();
  const left =
    style.direction === 'rtl'
      ? bounds.right - pixels(style.paddingRight) - pixels(style.borderRightWidth)
      : bounds.left + pixels(style.paddingLeft) + pixels(style.borderLeftWidth);
  return {
    rect: new DOMRect(
      left,
      bounds.top + pixels(style.paddingTop) + pixels(style.borderTopWidth),
      0,
      lineHeight(style),
    ),
    surface: line,
  };
}

function topLayerContainer(editor: HTMLElement): HTMLElement | null {
  const selector =
    typeof editor.showPopover === 'function' ? 'dialog:modal, :popover-open' : 'dialog:modal';
  let element: Element | null = editor;
  while (element) {
    const container = element.closest<HTMLElement>(selector);
    if (container) return container;
    const root = element.getRootNode();
    element = root instanceof ShadowRoot ? root.host : null;
  }
  return null;
}

export class InlinePreedit {
  readonly element = document.createElement('span');
  private readonly portal = document.createElement('span');
  private readonly portalRoot = this.portal.attachShadow({ mode: 'closed' });
  private readonly sizeObserver = new ResizeObserver(() => this.render(this.editor, this.text));
  private observedRoot: HTMLElement | null = null;
  private readonly mirror = document.createElement('div');
  private readonly marker = document.createElement('span');
  private frame: number | undefined;
  private readonly fieldPlaceholderStyle = document.createElement('style');
  private fieldWithHiddenPlaceholder: HTMLInputElement | HTMLTextAreaElement | null = null;
  private slackRoot: HTMLElement | null = null;
  private slackPlaceholder: HTMLStyleElement | undefined;
  private readonly slackObserver = new MutationObserver(() => this.render(this.editor, this.text));
  private editor: HTMLElement | null = null;
  private text = '';

  constructor(private readonly root: ShadowRoot) {
    this.element.className = 'inline-preedit';
    this.element.style.cssText =
      'position:fixed;white-space:pre;pointer-events:none;text-decoration:underline;text-underline-offset:0.15em;background:Canvas';
    this.portal.style.cssText =
      'all:initial;position:fixed;inset:0;width:auto;height:auto;margin:0;padding:0;border:0;background:transparent;pointer-events:none;z-index:2147483647';
    if (typeof this.portal.showPopover === 'function') this.portal.popover = 'manual';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.fieldPlaceholderStyle.textContent =
      '[data-skk-inline-preedit]::placeholder { color: transparent !important; text-shadow: none !important }';
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
      this.watchSlack(null);
      this.watchSize(null);
      this.hide();
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

  private watchSlack(root: HTMLElement | null): void {
    if (this.slackRoot === root) return;
    this.slackObserver.disconnect();
    this.slackRoot = root;
    if (root)
      this.slackObserver.observe(root, { childList: true, characterData: true, subtree: true });
  }

  private watchSize(root: HTMLElement | null): void {
    if (this.observedRoot === root) return;
    this.sizeObserver.disconnect();
    this.observedRoot = root;
    if (root) this.sizeObserver.observe(root);
  }

  private mount(container: HTMLElement | null): void {
    if (!container) {
      if (this.element.parentNode === this.portalRoot) {
        this.root.append(this.element);
        this.portal.remove();
      }
      return;
    }
    if (this.portal.parentElement === container) return;
    // The preview must be a descendant of a modal to escape inertness.
    // A manual popover also keeps viewport coordinates through transforms.
    container.append(this.portal);
    this.portalRoot.append(this.element);
    if (typeof this.portal.showPopover === 'function') this.portal.showPopover();
  }

  private hide(): void {
    this.element.hidden = true;
    this.mount(null);
    this.updateFieldPlaceholder(null);
    if (this.slackPlaceholder) this.slackPlaceholder.disabled = true;
  }

  private updateFieldPlaceholder(field: HTMLInputElement | HTMLTextAreaElement | null): void {
    if (this.fieldWithHiddenPlaceholder === field) return;
    this.fieldWithHiddenPlaceholder?.removeAttribute('data-skk-inline-preedit');
    this.fieldWithHiddenPlaceholder = field;
    if (field) {
      const root = field.getRootNode();
      (root instanceof ShadowRoot ? root : field.ownerDocument.documentElement).append(
        this.fieldPlaceholderStyle,
      );
      field.setAttribute('data-skk-inline-preedit', '');
    } else this.fieldPlaceholderStyle.remove();
  }

  private hideSlackPlaceholder(): void {
    if (!this.slackPlaceholder) {
      const style = document.createElement('style');
      style.textContent = `
        .ql-editor.ql-blank:focus::before { visibility: hidden !important }
        .c-texty_input:has(.ql-editor.ql-blank:focus) .ql-placeholder { visibility: hidden !important }
      `;
      document.documentElement.append(style);
      this.slackPlaceholder = style;
    }
    this.slackPlaceholder.disabled = false;
  }

  private position(): void {
    const editor = this.editor;
    if (!editor?.isConnected) {
      this.watchSlack(null);
      this.watchSize(null);
      this.hide();
      return;
    }
    const component = componentFor(editor);
    const root = component?.root ?? editor;
    this.watchSize(root);
    const slack = component?.kind === 'slack' && root.matches('.ql-editor');
    this.watchSlack(slack ? root : null);
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
    const field = editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement;
    const rich = !field && !componentCaret ? richCaret(editor) : null;
    if (!field && !componentCaret && !rich) {
      this.hide();
      return;
    }
    const surface = componentCaret
      ? (root.querySelector<HTMLElement>('.view-lines, .CodeMirror-code, .cm-content') ?? root)
      : (rich?.surface ?? editor);
    const style = getComputedStyle(surface);
    const bounds = root.getBoundingClientRect();
    const caret =
      componentCaret ??
      (field ? this.fieldCaret(editor, editor.getBoundingClientRect(), style) : rich!.rect);
    if (
      !bounds.width ||
      !bounds.height ||
      caret.left < bounds.left ||
      caret.left > bounds.right ||
      caret.bottom <= bounds.top ||
      caret.top >= bounds.bottom
    ) {
      this.hide();
      return;
    }
    if (slack) this.hideSlackPlaceholder();
    else if (this.slackPlaceholder) this.slackPlaceholder.disabled = true;
    this.updateFieldPlaceholder(field && editor.matches(':placeholder-shown') ? editor : null);
    this.mount(topLayerContainer(editor));
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
