package skk.editors.monaco

import scala.scalajs.js
import skk.Browser.*
import skk.editors.shared.EditContext

object EditContextInput:
  def insert(element: js.Dynamic, text: String): Boolean =
    val context = EditContext.of(element)
    if !exists(context) then return false
    val update = context.updateText
    // Monaco echoes its whole primary-selection buffer from zero. Use its
    // actual length so an echo cannot duplicate browser-applied native text.
    context.updateText = ((start: Int, end: Int, value: String) =>
      update.call(context, start, if start == 0 then str(context.text).length else end, value)
      ()): js.Function3[Int, Int, String, Unit]
    var end = int(context.selectionStart)
    try
      context.dispatchEvent(event("compositionstart"))
      val start = int(context.selectionStart)
      end = start + text.length
      context.dispatchEvent(EditContext.textUpdate(text, start, int(context.selectionEnd), end))
    finally
      try
        context.dispatchEvent(event("compositionend"))
        context.updateSelection(end, end)
      finally context.updateText = update
    true
