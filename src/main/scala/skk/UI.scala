package skk

import scala.scalajs.js
import Browser.*
import editors.Registry

final class UI(onToggle: () => Unit):
  val host = create("div")
  host.style.cssText = "all:initial;font:14px/1.5 system-ui,sans-serif;color:#182331;color-scheme:light;position:fixed;inset:0;pointer-events:none;z-index:2147483647"
  val root = host.attachShadow(obj("mode" -> "closed"))
  private val style = create("style")
  style.textContent = """
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
    """
  root.append(style)
  val panel = create("div", cls = "panel")
  panel.hidden = true
  listen(panel, "pointerdown")(_.preventDefault())
  listen(panel, "click"): e =>
    if exists(e.target.closest("[data-toggle]")) then onToggle()
  val settings = create("div", cls = "backdrop")
  settings.hidden = true
  root.append(panel, settings)
  document.documentElement.append(host)
  private var status = ""
  private var modeNotice = false
  private var lastMode = Mode.Ascii
  private var modeTimer: js.Dynamic = null
  private var statusTimer: js.Dynamic = null
  private var refresh: () => Unit = () => ()
  def message(text: String): Unit =
    status = text
    global.clearTimeout(statusTimer)
    statusTimer = delay(3500):
      status = ""
      refresh()
  def render(engine: Engine, editor: js.Dynamic, choose: Int => Unit): Unit =
    refresh = () => render(engine, editor, choose)
    if engine.mode != lastMode then
      lastMode = engine.mode
      modeNotice = true
      global.clearTimeout(modeTimer)
      modeTimer = delay(800):
        modeNotice = false
        refresh()
    panel.hidden = !exists(editor) || !bool(settings.hidden) || !(engine.active || modeNotice || status.nonEmpty)
    if !exists(editor) || bool(panel.hidden) then return
    panel.replaceChildren()
    val head = create("div", cls = "head")
    val labels = Map(Mode.Ascii -> "A", Mode.Hiragana -> "あ", Mode.Katakana -> "ア", Mode.Fullwidth -> "Ａ")
    val badge = create("button", "SKK " + labels(engine.mode))
    badge.dataset.toggle = ""
    badge.title = "Toggle SKK: Ctrl+Shift+Space"
    val preedit = create("span", engine.preedit, "preedit")
    preedit.title = engine.preedit
    preedit.setAttribute("aria-live", "polite")
    head.append(badge, preedit)
    panel.append(head)
    if engine.phase == Phase.Candidate then
      val candidates = create("div", cls = "candidates")
      val start = engine.index / 5 * 5
      engine.candidates.slice(start, start + 5).zipWithIndex.foreach: (candidate, offset) =>
        val text = candidate.text + engine.display(engine.okuri)
        val button = create("button", s"${start + offset + 1}. $text")
        button.title = text + (if candidate.annotation.nonEmpty then " — " + candidate.annotation else "")
        button.classList.toggle("selected", start + offset == engine.index)
        button.setAttribute("aria-pressed", (start + offset == engine.index).toString)
        listen(button, "click")(_ => choose(start + offset))
        candidates.append(button)
      panel.append(candidates)
      val selected = candidates.querySelector(".selected")
      if exists(selected) then candidates.scrollLeft =
        math.max(0, int(selected.offsetLeft) - int(candidates.offsetLeft) -
          (int(candidates.clientWidth) - int(selected.offsetWidth)) / 2.0)
    if status.nonEmpty && !engine.active then
      val note = create("span", status, "status")
      note.title = status
      note.setAttribute("role", "status")
      preedit.replaceWith(note)
    val anchor = Registry.component(editor).map(_.root).getOrElse(editor)
    val rect = anchor.getBoundingClientRect()
    val left = rect.left.asInstanceOf[Double]
    val top = rect.top.asInstanceOf[Double]
    val bottom = rect.bottom.asInstanceOf[Double] + 5
    val width = int(global.innerWidth)
    val viewportHeight = int(global.innerHeight)
    val height = int(panel.offsetHeight)
    panel.style.left = math.max(8, math.min(left, width - int(panel.offsetWidth) - 8)).toString + "px"
    panel.style.top = math.max(8, if bottom + height < viewportHeight then bottom
      else math.min(top - height - 5, viewportHeight - height - 8)).toString + "px"
  def dialog(title: String): js.Dynamic =
    settings.replaceChildren()
    settings.hidden = false
    panel.hidden = true
    val dialog = create("div", cls = "dialog")
    dialog.setAttribute("role", "dialog")
    dialog.setAttribute("aria-modal", "true")
    dialog.append(create("h2", title))
    settings.append(dialog)
    dialog
  def close(): Unit = settings.hidden = true
