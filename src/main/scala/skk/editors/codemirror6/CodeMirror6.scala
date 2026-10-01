package skk.editors.codemirror6

import scala.scalajs.js
import skk.Browser.*
import skk.editors.{Adapter, Registry}
import skk.editors.shared.{Clipboard, EditContext}

object CodeMirror6 extends Adapter:
  val kind = "codemirror6"
  def detect(element: js.Dynamic): js.Dynamic =
    if exists(element.closest(".cm-content")) then element.closest(".cm-editor") else null
  def snapshot(root: js.Dynamic): String = Registry.surface(root, ".cm-content")
  def insert(element: js.Dynamic, text: String): Boolean =
    if exists(EditContext.of(element)) then EditContextInput.insert(element, text) else Clipboard.insert(element, text)
