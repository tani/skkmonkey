package skk.editors.prosemirror

import scala.scalajs.js
import skk.editors.{Adapter, Registry}
import skk.editors.shared.Clipboard

object ProseMirror extends Adapter:
  val kind = "prosemirror"
  def detect(element: js.Dynamic): js.Dynamic = element.closest(".ProseMirror")
  def snapshot(root: js.Dynamic): String = Registry.surface(root, ".ProseMirror")
  def insert(element: js.Dynamic, text: String): Boolean = Clipboard.insert(element, text)
