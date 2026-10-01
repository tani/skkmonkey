package skk

import scala.scalajs.js
import scala.concurrent.Future
import scala.scalajs.concurrent.JSExecutionContext.Implicits.queue
import Browser.*
import editors.Registry
import editors.native.FindEditor
import editors.shared.EditContext

object Userscript:
  private val SourceKey = "skk.dictionary.v1"
  private val UserKey = "skk.user.v1"
  def main(args: Array[String]): Unit =
    // Scala.js unit tests run in Node; there is no DOM initializer there.
    if exists(global.document) then initialize().failed.foreach(e =>
      global.console.error("SKK userscript initialization failed:", e.toString))
  private def initialize(): Future[Unit] =
    val source = call[js.Any](GM.GM_getValue(SourceKey, ""))
    val user = call[js.Any](GM.GM_getValue(UserKey, obj()))
    val resource = Resource.load()
    for
      text <- source
      learned <- user
      cached <- resource
    yield
      val starter = new Dictionary(StarterDictionary.text)
      val defaults = new Dictionary
      defaults.base = cached.map(d => Dictionary.merge(d, starter)).getOrElse(starter.base)
      val dictionary = new Dictionary("", learned)
      dictionary.base = Dictionary.merge(
        new Dictionary(if js.typeOf(text) == "string" then text.asInstanceOf[String] else ""), defaults)
      new Session(dictionary, defaults, cached.nonEmpty).install()

  private final class Session(dictionary: Dictionary, defaults: Dictionary, hasResource: Boolean):
    private val engine = new Engine(dictionary)
    private var editor: js.Dynamic = null
    private var bookmark: Option[Bookmark] = None
    private var nativeComposition = false
    private var registering = false
    private var writing = false
    private var normalizing = false
    private var normalizationId = 0
    private val watchedContexts = js.Dynamic.newInstance(global.WeakSet)()
    private var saveQueue: Future[Unit] = Future.successful(())
    private var savedRevision = 0
    private val ui = new UI(() => toggle())
    private def save(): Unit =
      if dictionary.revision == savedRevision then return
      savedRevision = dictionary.revision
      val snapshot = dictionary.snapshot()
      saveQueue = saveQueue.flatMap(_ => call[js.Any](GM.GM_setValue(UserKey, snapshot)).map(_ => ()))
        .recover: _ =>
          savedRevision = -1
          ui.message("学習結果を保存できませんでした。")
          render()
    private def render(): Unit =
      ui.render(engine, editor, index =>
        engine.index = index
        commit(engine.finish())
        save()
        render())
    private def normalize(target: js.Dynamic): Unit =
      if Registry.component(target).isEmpty then return
      normalizationId += 1
      val id = normalizationId
      normalizing = true
      frame:
        if id == normalizationId && editor == target then
          bookmark = Some(new Bookmark(target))
          normalizing = false
    private def watchNative(target: js.Dynamic): Unit =
      val context = EditContext.of(target)
      if !exists(context) || bool(watchedContexts.has(context)) then return
      watchedContexts.add(context)
      listen(context, "textupdate"): _ =>
        if !writing && editor == target then
          engine.reset()
          bookmark = None
          normalize(target)
          render()
      listen(context, "compositionstart"): _ =>
        if !writing && editor == target then
          settle()
          nativeComposition = true
      listen(context, "compositionend"): _ =>
        if !writing && editor == target then
          nativeComposition = false
          normalize(target)
    private def commit(text: String): Boolean =
      if text.isEmpty then return true
      // Component handlers may rebuild their input on the next animation frame.
      if normalizing && exists(editor) then bookmark = Some(new Bookmark(editor))
      writing = true
      val inserted = try bookmark.exists(_.insert(text)) finally writing = false
      if !inserted then
        engine.reset()
        ui.message("入力位置が変わったため変換を取り消しました。")
      bookmark = if exists(editor) then Some(new Bookmark(editor)) else None
      if inserted && exists(editor) then normalize(editor)
      inserted
    private def settle(): Unit =
      if engine.active then
        commit(engine.finish())
        save()
      engine.reset()
      bookmark = None
      normalizing = false
      normalizationId += 1
    private def toggle(): Unit =
      if registering then return
      commit(engine.setMode(if engine.mode == Mode.Ascii then Mode.Hiragana else Mode.Ascii))
      save()
      render()
    private def button(label: String)(fn: => Unit): js.Dynamic =
      val node = create("button", label)
      listen(node, "click")(_ => fn)
      node
    private def register(request: Registration): Unit =
      registering = true
      val original = editor
      val originalBookmark = bookmark
      val dialog = ui.dialog(s"単語登録: ${request.key}")
      val description = create("p",
        s"${request.reading} の漢字部分を入力してください。送り仮名は自動で付加します。OS の IME または貼り付けを使用できます。")
      val input = create("input")
      input.`type` = "text"
      input.autocomplete = "off"
      input.setAttribute("aria-label", "登録する単語")
      val note = create("p", cls = "note")
      val actions = create("div", cls = "actions")
      def close(accept: Boolean): Unit =
        if accept && !Dictionary.validText(str(input.value)) then
          note.textContent = "空文字、改行、/、; は登録できません。"
          return
        ui.close()
        val restored = originalBookmark.exists(_.restoreFocus())
        if restored && exists(original) then bookmark = Some(new Bookmark(original))
        else
          if exists(original) then original.focus()
          engine.reset()
          ui.message("登録中に入力位置が変わったため変換を取り消しました。")
        registering = false
        if accept && restored then
          commit(engine.register(str(input.value)))
          save()
        render()
      actions.append(button("登録")(close(true)), button("取消")(close(false)))
      listen(input, "keydown"): e =>
        if !bool(e.isComposing) then
          str(e.key) match
            case "Enter" => e.preventDefault(); close(true)
            case "Escape" => e.preventDefault(); close(false)
            case _ => ()
      dialog.append(description, input, note, actions)
      input.focus()
    private def download(name: String, text: String): Unit =
      val blob = js.Dynamic.newInstance(global.Blob)(js.Array(text), obj("type" -> "text/plain;charset=utf-8"))
      val url = global.URL.createObjectURL(blob)
      val anchor = create("a")
      anchor.href = url
      anchor.download = name
      anchor.click()
      delay(1000)(global.URL.revokeObjectURL(url))
    private def settings(): Unit =
      settle()
      val original = editor
      val dialog = ui.dialog("SKK 辞書設定")
      def count(n: Int): String = global.Number(n).toLocaleString().asInstanceOf[String]
      val state = if hasResource then "SKK-JISYO.L を使用中。" else "SKK-JISYO.L を読み込めなかったため内蔵小辞書を使用中。"
      val text = create("p", s"現在 ${count(dictionary.base.size)} 見出し、登録・学習 ${count(dictionary.user.size)} 見出し。$state" +
        "追加辞書をローカルから読み込めます。入力内容の送信は行いません。")
      val encoding = create("select")
      Vector("auto" -> "自動判定 (UTF-8 → EUC-JP)", "utf-8" -> "UTF-8", "euc-jp" -> "EUC-JP").foreach: (value, label) =>
        val option = create("option", label)
        option.value = value
        encoding.append(option)
      val input = create("input")
      input.`type` = "file"
      input.setAttribute("aria-label", "SKK 辞書ファイル")
      val message = create("p", cls = "note")
      message.setAttribute("role", "status")
      listen(input, "change"): _ =>
        val file = if exists(input.files) then input.files.applyDynamic("item")(0) else null
        if exists(file) then
          if file.size.asInstanceOf[Double] > 32 * 1024 * 1024 then
            message.textContent = "32 MiB 以下の辞書を選択してください。"
          else
            message.textContent = "辞書を読み込み中…"
            val imported = call[js.Any](file.arrayBuffer()).flatMap: bytes =>
              val selected = str(encoding.value)
              val source =
                if selected == "auto" then
                  try decode(bytes, "utf-8") catch case _: Throwable => decode(bytes, "euc-jp")
                else decode(bytes, selected)
              val dictionary = new Dictionary(source)
              if dictionary.base.isEmpty then throw new Exception("SKK 形式の見出しが見つかりません。")
              call[js.Any](GM.GM_setValue(SourceKey, source)).map(_ => dictionary)
            imported.foreach: imported =>
              dictionary.base = Dictionary.merge(imported, defaults)
              message.textContent = s"${str(file.name)}: ${count(imported.base.size)} 見出しを保存しました。以前の取込辞書を置換しました。"
            imported.failed.foreach(e => message.textContent = s"読込失敗: ${e.getMessage}")
      val actions = create("div", cls = "actions")
      actions.append(
        button("登録・学習辞書をエクスポート")(download("SKK-JISYO.userscript", dictionary.exportUser())),
        button("閉じる") {
          ui.close()
          if exists(original) then original.focus()
          render()
        })
      val help = create("p",
        "Ctrl+Shift+Space: 有効／無効 · Ctrl+J: ひらがな · q: カタカナ · l: 英数 · L: 全角英数 · /: 略語変換。" +
          "新しい辞書は次回読込時から他のタブにも反映されます。", "note")
      val fileLabel = create("label", "辞書ファイル ")
      fileLabel.append(input)
      val encodingLabel = create("label", "文字コード ")
      encodingLabel.append(encoding)
      dialog.append(text, encodingLabel, fileLabel, message, help, actions)
      encoding.focus()
    private def path(e: js.Dynamic): js.Array[js.Dynamic] = e.composedPath().asInstanceOf[js.Array[js.Dynamic]]
    private def keydown(e: js.Dynamic): Unit =
      if !bool(ui.settings.hidden) || nativeComposition || bool(e.isComposing) || int(e.keyCode) == 229 then return
      val target = FindEditor(path(e))
      if !exists(target) then return
      if target != editor then
        settle()
        editor = target
        bookmark = None
      watchNative(target)
      if bookmark.exists(b => !b.valid()) && !normalizing then
        engine.reset()
        bookmark = None
      if bookmark.isEmpty then bookmark = Some(new Bookmark(editor))
      val ctrl = bool(e.ctrlKey)
      val shift = bool(e.shiftKey)
      val alt = bool(e.altKey)
      val meta = bool(e.metaKey)
      if ctrl && shift && !alt && !meta && str(e.code) == "Space" then
        e.preventDefault()
        e.stopImmediatePropagation()
        toggle()
        return
      val lower = str(e.key).toLowerCase
      val key = if ctrl && !alt && !meta && !shift && Set("j", "g", "h")(lower) then "C-" + lower else str(e.key)
      if alt || meta || (ctrl && !key.startsWith("C-")) then
        if engine.active then
          if lower == "z" then
            engine.reset()
            bookmark = None
          else settle()
        render()
        return
      val result = engine.handle(key)
      if result.handled then
        e.preventDefault()
        e.stopImmediatePropagation()
        if commit(result.committed) then
          if result.committed.nonEmpty then save()
          result.registration.foreach(register)
      else if engine.active && navigation(key) then settle()
      if !result.handled && navigation(key) && key != "Tab" then
        bookmark = None
        normalize(target)
      render()
    private val navigation = Set("ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
      "PageUp", "PageDown", "Tab", "Delete")
    def install(): Unit =
      GM.GM_registerMenuCommand("SKK: 辞書設定 / Dictionary settings", (() => settings()): js.Function0[Unit])
      GM.GM_registerMenuCommand("SKK: 入力切替 / Toggle input", (() => toggle()): js.Function0[Unit])
      GM.GM_registerMenuCommand("SKK: 登録・学習辞書をエクスポート",
        (() => download("SKK-JISYO.userscript", dictionary.exportUser())): js.Function0[Unit])
      listen(document, "focusin", true): e =>
        if bool(ui.settings.hidden) then
          val next = FindEditor(path(e))
          if next != editor then
            settle()
            editor = next
          bookmark = if exists(editor) then Some(new Bookmark(editor)) else None
          render()
          if exists(editor) then
            watchNative(editor)
            normalize(editor)
      listen(document, "focusout", true): _ =>
        if !registering then
          settle()
          editor = null
          render()
      listen(document, "compositionstart", true): _ =>
        if bool(ui.settings.hidden) then
          settle()
          nativeComposition = true
      listen(document, "compositionend", true)(_ => nativeComposition = false)
      listen(document, "input", true): e =>
        if !writing && FindEditor(path(e)) == editor then
          engine.reset()
          bookmark = None
          if exists(editor) then normalize(editor)
          render()
      listen(document, "pointerdown", true): e =>
        if bool(ui.settings.hidden) && FindEditor(path(e)) == editor then
          settle()
          if exists(editor) then normalize(editor)
          render()
      listen(document, "paste", true): _ =>
        if !writing && bool(ui.settings.hidden) then
          settle()
          render()
      listen(document, "cut", true): _ =>
        if bool(ui.settings.hidden) then
          settle()
          render()
      listen(document, "keydown", true)(keydown)
      editor = if exists(document.activeElement) then FindEditor(js.Array(document.activeElement)) else null
      bookmark = if exists(editor) then Some(new Bookmark(editor)) else None
      render()
      if exists(editor) then watchNative(editor)
      listen(global, "resize")(_ => render())
      listen(document, "scroll", true)(_ => render())
