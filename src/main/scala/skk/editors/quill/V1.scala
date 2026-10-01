package skk.editors.quill

import scala.scalajs.js
import skk.Browser.*

object V1:
  def instanceOf(element: js.Dynamic): js.Dynamic =
    val root = element.closest(".ql-container")
    val instance = if exists(root) then root.__quill else null
    if exists(instance) && instance.root == element &&
      js.typeOf(instance.updateContents) == "function" && js.typeOf(instance.getContents) == "function" &&
      exists(instance.history) && js.typeOf(instance.history.cutoff) == "function"
    then instance else null
  def insert(element: js.Dynamic, text: String): Boolean =
    val quill = instanceOf(element)
    if !exists(quill) || !bool(quill.isEnabled()) then return false
    val range = quill.getSelection()
    if !exists(range) then return false
    // Quill 1 needs its container instance hook and a user Delta transaction;
    // its asynchronous native paste handler cannot consume a synthetic paste.
    quill.history.cutoff()
    val delta = quill.getContents(0, 0).retain(range.index).applyDynamic("delete")(range.length)
      .insert(text, quill.getFormat(range.index))
    quill.updateContents(delta, "user")
    quill.setSelection(int(range.index) + text.length, 0, "silent")
    quill.history.cutoff()
    true
