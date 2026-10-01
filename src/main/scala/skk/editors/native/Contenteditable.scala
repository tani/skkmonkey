package skk.editors.native

import scala.scalajs.js
import skk.Browser.*

object Contenteditable:
  def selection(element: js.Dynamic): js.Dynamic =
    val root = element.getRootNode()
    if js.typeOf(root.getSelection) == "function" then root.getSelection() else document.getSelection()
  def insert(element: js.Dynamic, text: String, range: js.Dynamic): Boolean =
    val selected = selection(element)
    if exists(selected) then
      selected.removeAllRanges()
      selected.addRange(range)
    if bool(document.execCommand("insertText", false, text)) then return true
    range.deleteContents()
    val node = document.createTextNode(text)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    if exists(selected) then
      selected.removeAllRanges()
      selected.addRange(range)
    element.dispatchEvent(inputEvent("input", text))
    true
