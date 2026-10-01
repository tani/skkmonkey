package skk.editors.shared

import scala.scalajs.js
import skk.Browser.*

object Clipboard:
  def insert(element: js.Dynamic, text: String): Boolean =
    // Flush public selection notification before component paste transactions.
    element.ownerDocument.dispatchEvent(event("selectionchange"))
    val data = js.Dynamic.newInstance(global.DataTransfer)()
    data.setData("text/plain", text)
    val paste = js.Dynamic.newInstance(global.ClipboardEvent)("paste",
      obj("bubbles" -> true, "composed" -> true, "cancelable" -> true))
    // Firefox protects constructor clipboard data; attach plaintext to this
    // synthetic event without accessing the system clipboard.
    global.Object.defineProperty(paste, "clipboardData", obj("value" -> data))
    element.dispatchEvent(paste)
    bool(paste.defaultPrevented)
