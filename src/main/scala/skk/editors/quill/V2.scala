package skk.editors.quill

import scala.scalajs.js
import skk.editors.shared.Clipboard

object V2:
  def insert(element: js.Dynamic, text: String): Boolean = Clipboard.insert(element, text)
