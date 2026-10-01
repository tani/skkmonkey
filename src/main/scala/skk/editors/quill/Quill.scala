package skk.editors.quill

import scala.scalajs.js
import skk.Browser.*
import skk.editors.{Adapter, Registry}

object Quill extends Adapter:
  val kind = "quill"
  def detect(element: js.Dynamic): js.Dynamic =
    if exists(element.closest(".ql-editor")) then element.closest(".ql-container") else null
  def snapshot(root: js.Dynamic): String = Registry.surface(root, ".ql-editor")
  def insert(element: js.Dynamic, text: String): Boolean =
    if exists(V1.instanceOf(element)) then V1.insert(element, text) else V2.insert(element, text)
