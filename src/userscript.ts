import { Dictionary } from './dictionary.ts';
import { Engine } from './engine.ts';
import { Bookmark, findEditor, type Editor } from './editor.ts';
import { starterDictionary } from './starter-dictionary.ts';
import { UI } from './ui.ts';
import { loadResourceDictionary, mergeDictionaries } from './resource.ts';
import { componentFor, nativeContext } from './component.ts';
import type { PendingInsertion } from './editors/types.ts';

const SOURCE_KEY = 'skk.dictionary.v1';
const USER_KEY = 'skk.user.v1';

async function main(): Promise<void> {
  const [source, user, resource] = await Promise.all([
    GM_getValue<unknown>(SOURCE_KEY, ''),
    GM_getValue<unknown>(USER_KEY, {}),
    loadResourceDictionary(),
  ]);
  const starter = new Dictionary(starterDictionary);
  const defaults = resource ? mergeDictionaries(resource, starter) : starter.base;
  const defaultDictionary = new Dictionary();
  defaultDictionary.base = defaults;
  const dictionary = new Dictionary('', user);
  dictionary.base = mergeDictionaries(
    new Dictionary(typeof source === 'string' ? source : ''),
    defaultDictionary,
  );
  const engine = new Engine(dictionary);
  let editor: Editor | null = null;
  let bookmark: Bookmark | null = null;
  let registering = false;
  let writing = false;
  let pending: {
    editor: Editor;
    insertion: PendingInsertion;
    queued: string;
    stop(): void;
  } | null = null;
  let normalizing = false;
  let normalizationId = 0;
  const watchedContexts = new WeakSet<EventTarget>();
  let saveQueue = Promise.resolve();
  let savedRevision = 0;
  const ui = new UI(toggle);

  function save(): void {
    if (dictionary.revision === savedRevision) return;
    savedRevision = dictionary.revision;
    const snapshot = JSON.parse(JSON.stringify(dictionary.user)) as unknown;
    saveQueue = saveQueue
      .then(() => GM_setValue(USER_KEY, snapshot))
      .catch(() => {
        savedRevision = -1;
        ui.message('学習結果を保存できませんでした。');
        render();
      });
  }
  function render(): void {
    ui.render(engine, editor, (index) => {
      engine.index = index;
      commit(engine.finish());
      save();
      render();
    });
  }
  function normalize(target: Editor): void {
    const component = componentFor(target);
    if (!component || component.kind === 'slate') return;
    const id = ++normalizationId;
    normalizing = true;
    const normalized = (): void => {
      if (id !== normalizationId || editor !== target) return;
      bookmark = new Bookmark(target);
      normalizing = false;
    };
    requestAnimationFrame(normalized);
  }
  function clearPending(): void {
    pending?.stop();
    pending = null;
  }
  function checkPending(): void {
    const edit = pending;
    if (!edit || editor !== edit.editor || !edit.insertion.applied()) return;
    clearPending();
    bookmark = new Bookmark(edit.editor);
    if (!commit(edit.queued)) render();
    else ui.renderInline(engine, editor);
  }
  function waitForInsertion(target: Editor, insertion: PendingInsertion): void {
    const observer = new MutationObserver(checkPending);
    const checkSelection = (): void => queueMicrotask(checkPending);
    observer.observe(target, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
    });
    target.ownerDocument.addEventListener('selectionchange', checkSelection);
    const timeout = window.setTimeout(() => {
      checkPending();
      if (pending?.insertion !== insertion) return;
      clearPending();
      engine.reset();
      bookmark = editor ? new Bookmark(editor) : null;
      ui.message('変換結果の反映を確認できませんでした。');
      render();
    }, 1500);
    pending = {
      editor: target,
      insertion,
      queued: '',
      stop() {
        observer.disconnect();
        target.ownerDocument.removeEventListener('selectionchange', checkSelection);
        window.clearTimeout(timeout);
      },
    };
    queueMicrotask(checkPending);
  }
  function reconcileInput(target: Editor, trusted = false): void {
    if (writing || editor !== target) return;
    if (pending?.editor === target) {
      if (!trusted || pending.insertion.applied()) {
        queueMicrotask(checkPending);
        return;
      }
      clearPending();
    }
    // A delayed notification can describe an edit already included in the
    // post-commit bookmark. Cancel only when the document or caret changed.
    if (bookmark?.valid()) return;
    engine.reset();
    bookmark = null;
    normalize(target);
    render();
  }
  function startComposition(event: Event, target: Editor): void {
    // Let the OS IME take over this field without treating an editor's
    // synthetic composition events as a native input session.
    if (event.isTrusted && !writing && ui.settings.hidden && editor === target) settle();
  }
  function watchNative(target: Editor): void {
    const context = nativeContext(target);
    if (!context || watchedContexts.has(context)) return;
    watchedContexts.add(context);
    context.addEventListener('textupdate', () => reconcileInput(target));
    context.addEventListener('compositionstart', (event) => startComposition(event, target));
  }
  function commit(text: string): boolean {
    if (!text) return true;
    if (pending && pending.editor === editor) {
      pending.queued += text;
      return true;
    }
    // Component paste handlers update their models immediately, but may rebuild
    // hidden inputs/selection on the next animation frame. During that own-edit
    // window take a fresh DOM snapshot rather than discarding pending romaji.
    if (normalizing && editor) bookmark = new Bookmark(editor);
    writing = true;
    let inserted: boolean | PendingInsertion = false;
    try {
      inserted = bookmark?.insert(text) ?? false;
    } finally {
      writing = false;
    }
    if (typeof inserted !== 'boolean' && editor) {
      waitForInsertion(editor, inserted);
      return true;
    }
    // A single key can finish a candidate and start the next syllable.
    // The editor may consume or reject the candidate; keep that next syllable.
    if (!inserted) ui.message('変換結果の挿入を確認できませんでした。');
    bookmark = editor ? new Bookmark(editor) : null;
    if (inserted && editor) normalize(editor);
    return inserted === true;
  }
  function settle(): void {
    checkPending();
    if (pending) {
      if (pending.queued) ui.message('入力先が変わったため、未反映の入力を取り消しました。');
      clearPending();
    } else if (engine.active) {
      commit(engine.finish());
      save();
    }
    engine.reset();
    bookmark = null;
    normalizing = false;
    normalizationId++;
  }
  function toggle(): void {
    if (registering) return;
    commit(engine.setMode(engine.mode === 'ascii' ? 'hiragana' : 'ascii'));
    save();
    render();
  }
  function button(label: string, fn: () => void): HTMLButtonElement {
    const element = document.createElement('button');
    element.textContent = label;
    element.addEventListener('click', fn);
    return element;
  }
  function register(key: string, reading: string): void {
    registering = true;
    const original = editor;
    const originalBookmark = bookmark;
    const dialog = ui.dialog(`単語登録: ${key}`);
    const description = document.createElement('p');
    description.textContent = `${reading} の漢字部分を入力してください。送り仮名は自動で付加します。OS の IME または貼り付けを使用できます。`;
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', '登録する単語');
    const note = document.createElement('p');
    note.className = 'note';
    const actions = document.createElement('div');
    actions.className = 'actions';
    const close = (accept: boolean): void => {
      if (accept && (!input.value || /[\r\n/;]/.test(input.value) || input.value.length > 1000)) {
        note.textContent = '空文字、改行、/、; は登録できません。';
        return;
      }
      ui.close();
      const restored = originalBookmark?.restoreFocus() ?? false;
      if (restored && original) bookmark = new Bookmark(original);
      else {
        original?.focus();
        engine.reset();
        ui.message('登録中に入力位置が変わったため変換を取り消しました。');
      }
      registering = false;
      if (accept && restored) {
        commit(engine.register(input.value));
        save();
      }
      render();
    };
    actions.append(
      button('登録', () => close(true)),
      button('取消', () => close(false)),
    );
    input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        close(true);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      }
    });
    dialog.append(description, input, note, actions);
    input.focus();
  }
  function download(name: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function settings(): void {
    settle();
    const original = editor;
    const dialog = ui.dialog('SKK 辞書設定');
    const text = document.createElement('p');
    text.textContent = `現在 ${dictionary.base.size.toLocaleString()} 見出し、登録・学習 ${Object.keys(dictionary.user).length.toLocaleString()} 見出し。${resource ? 'SKK-JISYO.L を使用中。' : 'SKK-JISYO.L を読み込めなかったため内蔵小辞書を使用中。'}追加辞書をローカルから読み込めます。入力内容の送信は行いません。`;
    const encoding = document.createElement('select');
    for (const [value, label] of [
      ['auto', '自動判定 (UTF-8 → EUC-JP)'],
      ['utf-8', 'UTF-8'],
      ['euc-jp', 'EUC-JP'],
    ]) {
      const option = document.createElement('option');
      option.value = value!;
      option.textContent = label!;
      encoding.append(option);
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('aria-label', 'SKK 辞書ファイル');
    const message = document.createElement('p');
    message.className = 'note';
    message.setAttribute('role', 'status');
    input.addEventListener('change', () => {
      void (async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 32 * 1024 * 1024) {
          message.textContent = '32 MiB 以下の辞書を選択してください。';
          return;
        }
        try {
          message.textContent = '辞書を読み込み中…';
          const bytes = await file.arrayBuffer();
          let source: string;
          if (encoding.value === 'auto') {
            try {
              source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            } catch {
              source = new TextDecoder('euc-jp', { fatal: true }).decode(bytes);
            }
          } else source = new TextDecoder(encoding.value, { fatal: true }).decode(bytes);
          const imported = new Dictionary(source);
          if (!imported.base.size) throw new Error('SKK 形式の見出しが見つかりません。');
          await GM_setValue(SOURCE_KEY, source);
          dictionary.base = mergeDictionaries(imported, defaultDictionary);
          message.textContent = `${file.name}: ${imported.base.size.toLocaleString()} 見出しを保存しました。以前の取込辞書を置換しました。`;
        } catch (error) {
          message.textContent = `読込失敗: ${error instanceof Error ? error.message : String(error)}`;
        }
      })();
    });
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(
      button('登録・学習辞書をエクスポート', () =>
        download('SKK-JISYO.userscript', dictionary.exportUser()),
      ),
      button('閉じる', () => {
        ui.close();
        original?.focus();
        render();
      }),
    );
    const help = document.createElement('p');
    help.className = 'note';
    help.textContent =
      'Ctrl+Shift+Space: 有効／無効 · Ctrl+J: ひらがな · q: カタカナ · l: 英数 · L: 全角英数 · /: 略語変換。新しい辞書は次回読込時から他のタブにも反映されます。';
    const fileLabel = document.createElement('label');
    fileLabel.textContent = '辞書ファイル ';
    fileLabel.append(input);
    const encodingLabel = document.createElement('label');
    encodingLabel.textContent = '文字コード ';
    encodingLabel.append(encoding);
    dialog.append(text, encodingLabel, fileLabel, message, help, actions);
    encoding.focus();
  }

  GM_registerMenuCommand('SKK: 辞書設定 / Dictionary settings', settings);
  GM_registerMenuCommand('SKK: 入力切替 / Toggle input', toggle);
  GM_registerMenuCommand('SKK: 登録・学習辞書をエクスポート', () =>
    download('SKK-JISYO.userscript', dictionary.exportUser()),
  );

  document.addEventListener(
    'focusin',
    (e) => {
      if (!ui.settings.hidden) return;
      const next = findEditor(e.composedPath());
      if (next !== editor) {
        settle();
        editor = next;
      }
      bookmark = editor ? new Bookmark(editor) : null;
      render();
      if (editor) {
        watchNative(editor);
        normalize(editor);
      }
    },
    true,
  );
  document.addEventListener(
    'focusout',
    () => {
      if (registering) return;
      settle();
      editor = null;
      render();
    },
    true,
  );
  document.addEventListener(
    'compositionstart',
    (e) => {
      const target = findEditor(e.composedPath());
      if (target) startComposition(e, target);
    },
    true,
  );
  document.addEventListener(
    'input',
    (e) => {
      const target = findEditor(e.composedPath());
      if (target) reconcileInput(target, e.isTrusted);
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      // Resolve an active reading before the browser moves the caret.
      if (ui.settings.hidden && findEditor(e.composedPath()) === editor) {
        settle();
        if (editor) normalize(editor);
        render();
      }
    },
    true,
  );
  document.addEventListener(
    'paste',
    () => {
      if (!writing && ui.settings.hidden) {
        settle();
        render();
      }
    },
    true,
  );
  document.addEventListener(
    'cut',
    () => {
      if (ui.settings.hidden) {
        settle();
        render();
      }
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (e) => {
      // Use this key's native IME flags. A composition end can be missing or
      // retargeted, so a document-wide flag could leave ordinary keys bypassed.
      if (!ui.settings.hidden || e.isComposing || e.keyCode === 229) return;
      const target = findEditor(e.composedPath());
      if (!target) return;
      if (target !== editor) {
        settle();
        editor = target;
        bookmark = null;
      }
      watchNative(target);
      checkPending();
      if (!pending && bookmark && !bookmark.valid() && !normalizing) {
        engine.reset();
        bookmark = null;
      }
      bookmark ??= new Bookmark(editor);
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggle();
        return;
      }
      const control = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
      const key =
        control && ['j', 'g', 'h'].includes(e.key.toLowerCase())
          ? 'C-' + e.key.toLowerCase()
          : e.key;
      if (e.altKey || e.metaKey || (e.ctrlKey && !key.startsWith('C-'))) {
        if (engine.active || pending) {
          if (e.key.toLowerCase() === 'z') {
            clearPending();
            engine.reset();
            bookmark = null;
          } else settle();
        }
        render();
        return;
      }
      const result = engine.handle(key);
      // A chat composer can send on Enter. Keep it from sending a partial
      // draft while the editor has accepted text but has not rendered it.
      if (pending && !result.handled && key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (result.handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (commit(result.committed)) {
          if (result.committed) save();
          if (result.registration) register(result.registration.key, result.registration.reading);
        }
      } else if (
        engine.active &&
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
          'PageUp',
          'PageDown',
          'Tab',
          'Delete',
        ].includes(e.key)
      ) {
        settle();
      }
      if (
        !result.handled &&
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
          'PageUp',
          'PageDown',
          'Delete',
        ].includes(e.key)
      ) {
        bookmark = null;
        normalize(target);
      }
      render();
    },
    true,
  );
  // Support inputs focused before the asynchronous storage read finishes.
  editor = document.activeElement ? findEditor([document.activeElement]) : null;
  bookmark = editor ? new Bookmark(editor) : null;
  render();
  if (editor) watchNative(editor);
  document.addEventListener('selectionchange', () => ui.renderInline(engine, editor));
  window.addEventListener('resize', render);
  document.addEventListener('scroll', render, true);
}

void main().catch((error) => console.error('SKK userscript initialization failed:', error));
