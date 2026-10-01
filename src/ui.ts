import type { Engine } from './engine.ts';
import type { Editor } from './editor.ts';
import { componentFor } from './component.ts';

const labels = { ascii: 'A', hiragana: 'あ', katakana: 'ア', fullwidth: 'Ａ' };

export class UI {
  readonly host = document.createElement('div');
  readonly root: ShadowRoot;
  readonly panel: HTMLDivElement;
  readonly settings: HTMLDivElement;
  private status = '';
  private modeNotice = false;
  private lastMode: Engine['mode'] = 'ascii';
  private modeTimer?: ReturnType<typeof setTimeout>;
  private statusTimer?: ReturnType<typeof setTimeout>;
  private refresh = (): void => {};
  constructor(onToggle: () => void) {
    this.host.style.cssText = 'all:initial;font:14px/1.5 system-ui,sans-serif;color:#182331;color-scheme:light;position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    this.root = this.host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host{font:14px/1.5 system-ui,sans-serif;color:#182331;color-scheme:light}
      *{box-sizing:border-box}button,input,select{font:inherit}
      button{cursor:pointer;background:#eef3f8;border:1px solid #b6c5d6;border-radius:5px;padding:4px 9px;color:#182331}
      button:hover{background:#dce9f6}button:focus-visible{outline:2px solid #146cbd}
      .panel{position:fixed;max-width:min(320px,calc(100vw - 16px));overflow:hidden;background:#fff;
        border:1px solid #9caec1;box-shadow:0 3px 16px #0002;border-radius:5px;padding:4px 6px;pointer-events:auto}
      .head{display:flex;gap:6px;align-items:center;min-width:0}.head button{flex:none;padding:0 4px;font-size:12px;line-height:20px}
      .preedit{font-size:14px;line-height:22px;white-space:pre;overflow:hidden;text-overflow:ellipsis}
      .candidates{margin-top:2px;display:flex;gap:3px;overflow-x:auto;scrollbar-width:none}
      .candidates::-webkit-scrollbar{display:none}.candidates button{flex:none;padding:0 5px;line-height:22px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.selected{background:#146cbd;color:white}
      .status{max-width:100%;font-size:12px;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .note{color:#536476;font-size:12px;margin-top:5px;max-width:480px}
      .backdrop{position:fixed;inset:0;background:#0005;pointer-events:auto;display:grid;place-items:center}
      .dialog{background:white;border-radius:10px;padding:24px;width:min(590px,95vw);max-height:90vh;overflow:auto}
      h2{margin:0 0 12px;font-size:20px}p{margin:10px 0}label{display:block;margin:12px 0}
      input[type=text]{width:100%;padding:8px;border:1px solid #9caec1;border-radius:5px}
      .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}[hidden]{display:none!important}
    `;
    this.root.append(style);
    this.panel = document.createElement('div'); this.panel.className = 'panel'; this.panel.hidden = true;
    this.panel.addEventListener('pointerdown', e => e.preventDefault());
    this.panel.addEventListener('click', e => { if ((e.target as HTMLElement).closest('[data-toggle]')) onToggle(); });
    this.settings = document.createElement('div'); this.settings.className = 'backdrop'; this.settings.hidden = true;
    this.root.append(this.panel, this.settings); document.documentElement.append(this.host);
  }
  message(text: string): void {
    this.status = text;
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => { this.status = ''; this.refresh(); }, 3500);
  }
  render(engine: Engine, editor: Editor | null, choose: (index: number) => void): void {
    this.refresh = () => this.render(engine, editor, choose);
    if (engine.mode !== this.lastMode) {
      this.lastMode = engine.mode;
      this.modeNotice = true;
      clearTimeout(this.modeTimer);
      this.modeTimer = setTimeout(() => { this.modeNotice = false; this.refresh(); }, 800);
    }
    this.panel.hidden = !editor || !this.settings.hidden || !(engine.active || this.modeNotice || this.status);
    if (!editor || this.panel.hidden) return;
    this.panel.replaceChildren();
    const head = document.createElement('div'); head.className = 'head';
    const badge = document.createElement('button'); badge.dataset.toggle = '';
    badge.textContent = 'SKK ' + labels[engine.mode]; badge.title = 'Toggle SKK: Ctrl+Shift+Space';
    const preedit = document.createElement('span'); preedit.className = 'preedit'; preedit.textContent = engine.preedit; preedit.title = engine.preedit;
    preedit.setAttribute('aria-live', 'polite');
    head.append(badge, preedit); this.panel.append(head);
    if (engine.phase === 'candidate') {
      const candidates = document.createElement('div'); candidates.className = 'candidates';
      const start = Math.floor(engine.index / 5) * 5;
      engine.candidates.slice(start, start + 5).forEach((candidate, offset) => {
        const button = document.createElement('button');
        button.textContent = `${start + offset + 1}. ${candidate.text}${engine.display(engine.okuri)}`;
        button.title = `${candidate.text}${engine.display(engine.okuri)}${candidate.annotation ? ' — ' + candidate.annotation : ''}`; button.classList.toggle('selected', start + offset === engine.index);
        button.setAttribute('aria-pressed', String(start + offset === engine.index));
        button.addEventListener('click', () => choose(start + offset)); candidates.append(button);
      });
      this.panel.append(candidates);
      const selected = candidates.querySelector<HTMLElement>('.selected');
      if (selected) candidates.scrollLeft = Math.max(0, selected.offsetLeft - candidates.offsetLeft - (candidates.clientWidth - selected.offsetWidth) / 2);
    }
    if (this.status && !engine.active) {
      // Notices share the preedit row so candidates never create a third row.
      const note = document.createElement('span'); note.className = 'status';
      note.textContent = this.status; note.title = this.status; note.setAttribute('role', 'status');
      preedit.replaceWith(note);
    }
    const rect = (componentFor(editor)?.root ?? editor).getBoundingClientRect();
    // Anchor at the field edge; a caret mirror would mismeasure rich editors.
    this.panel.style.left = Math.max(8, Math.min(rect.left, innerWidth - this.panel.offsetWidth - 8)) + 'px';
    const height = this.panel.offsetHeight;
    const bottom = rect.bottom + 5;
    this.panel.style.top = Math.max(8, bottom + height < innerHeight ? bottom : Math.min(rect.top - height - 5, innerHeight - height - 8)) + 'px';
  }
  dialog(title: string): HTMLDivElement {
    this.settings.replaceChildren(); this.settings.hidden = false; this.panel.hidden = true;
    const dialog = document.createElement('div'); dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    const heading = document.createElement('h2'); heading.textContent = title; dialog.append(heading);
    this.settings.append(dialog); return dialog;
  }
  close(): void { this.settings.hidden = true; }
}
