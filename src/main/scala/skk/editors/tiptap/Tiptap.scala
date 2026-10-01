package skk.editors.tiptap

import scala.scalajs.js
import skk.editors.Adapter
import skk.editors.prosemirror.ProseMirror

object Tiptap extends Adapter:
  val kind = "tiptap"
  def detect(element: js.Dynamic): js.Dynamic = element.closest(".tiptap.ProseMirror")
  def snapshot(root: js.Dynamic): String = ProseMirror.snapshot(root)
  def insert(element: js.Dynamic, text: String): Boolean = ProseMirror.insert(element, text)
