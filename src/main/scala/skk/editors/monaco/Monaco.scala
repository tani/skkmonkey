package skk.editors.monaco

import scala.scalajs.js
import skk.Browser.*
import skk.editors.Adapter
import skk.editors.shared.EditContext

object Monaco extends Adapter:
  val kind = "monaco"
  def detect(element: js.Dynamic): js.Dynamic =
    if bool(element.matches("textarea.inputarea, .native-edit-context")) then element.closest(".monaco-editor") else null
  def snapshot(root: js.Dynamic): String =
    val nodes = global.Array.from(root.querySelectorAll(".cursor, .selected-text")).asInstanceOf[js.Array[js.Dynamic]]
    val carets = nodes.iterator.map(n => s"${str(n.style.top)}:${str(n.style.left)}:${str(n.style.width)}:${str(n.style.height)}").mkString("|")
    val lines = root.querySelector(".view-lines")
    (if exists(lines) then str(lines.textContent) else "") + "\u0000" + carets
  def insert(element: js.Dynamic, text: String): Boolean =
    if exists(EditContext.of(element)) then EditContextInput.insert(element, text) else Textarea.insert(element, text)
