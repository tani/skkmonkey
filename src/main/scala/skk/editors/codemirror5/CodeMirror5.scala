package skk.editors.codemirror5

import scala.scalajs.js
import skk.Browser.*
import skk.editors.{Adapter, Registry}
import skk.editors.shared.Clipboard

object CodeMirror5 extends Adapter:
  val kind = "codemirror5"
  def detect(element: js.Dynamic): js.Dynamic =
    if !(bool(element.matches("textarea")) && !exists(element.closest(".CodeMirror-dialog"))) &&
      !exists(element.closest(".CodeMirror-code")) then null
    else element.closest(".CodeMirror")
  def snapshot(root: js.Dynamic): String = Registry.surface(root, ".CodeMirror-code")
  def insert(element: js.Dynamic, text: String): Boolean = Clipboard.insert(element, text)
