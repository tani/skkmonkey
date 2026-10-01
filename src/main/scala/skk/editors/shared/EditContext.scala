package skk.editors.shared

import scala.scalajs.js
import skk.Browser.*

object EditContext:
  def of(element: js.Dynamic): js.Dynamic =
    val context = element.editContext
    if exists(context) && js.typeOf(context.text) == "string" then context else null
  def textUpdate(text: String, start: Int, end: Int, caret: Int): js.Dynamic =
    val update = event("textupdate")
    global.Object.defineProperties(update, obj(
      "text" -> obj("value" -> text),
      "updateRangeStart" -> obj("value" -> start),
      "updateRangeEnd" -> obj("value" -> end),
      "selectionStart" -> obj("value" -> caret),
      "selectionEnd" -> obj("value" -> caret)))
    update
