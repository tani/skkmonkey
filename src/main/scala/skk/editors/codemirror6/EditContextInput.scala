package skk.editors.codemirror6

import scala.scalajs.js
import skk.Browser.*
import skk.editors.shared.EditContext

object EditContextInput:
  def insert(element: js.Dynamic, text: String): Boolean =
    val context = EditContext.of(element)
    if !exists(context) then return false
    val start = int(context.selectionStart)
    val end = int(context.selectionEnd)
    context.dispatchEvent(event("compositionstart"))
    try
      // Older handlers require the browser buffer update before notification.
      context.updateText(start, end, text)
      context.updateSelection(start + text.length, start + text.length)
      context.dispatchEvent(EditContext.textUpdate(text, start, end, start + text.length))
    finally context.dispatchEvent(event("compositionend"))
    true
