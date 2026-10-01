package skk.editors.native

import scala.scalajs.js
import skk.Browser.*

object Input:
  def is(element: js.Dynamic): Boolean =
    instance(element, global.HTMLInputElement) || instance(element, global.HTMLTextAreaElement)
  def insert(element: js.Dynamic, text: String): Boolean =
    val start = if exists(element.selectionStart) then int(element.selectionStart) else 0
    val end = if exists(element.selectionEnd) then int(element.selectionEnd) else start
    val value = str(element.value)
    val next = value.take(start) + text + value.drop(end)
    val constructor = if instance(element, global.HTMLInputElement) then global.HTMLInputElement else global.HTMLTextAreaElement
    // Native setter preserves controlled-framework value tracking.
    global.Object.getOwnPropertyDescriptor(constructor.prototype, "value").set.call(element, next)
    element.setSelectionRange(start + text.length, start + text.length)
    element.dispatchEvent(inputEvent("input", text))
    true
