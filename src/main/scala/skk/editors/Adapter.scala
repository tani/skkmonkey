package skk.editors

import scala.scalajs.js
import skk.Browser.*

trait Adapter:
  def kind: String
  def detect(element: js.Dynamic): js.Dynamic
  def snapshot(root: js.Dynamic): String
  def insert(element: js.Dynamic, text: String): Boolean

final case class Component(adapter: Adapter, root: js.Dynamic):
  def kind: String = adapter.kind

object Registry:
  // Specific wrappers precede generic underlying editors.
  val adapters: Vector[Adapter] = Vector(
    monaco.Monaco, codemirror5.CodeMirror5, codemirror6.CodeMirror6,
    tiptap.Tiptap, prosemirror.ProseMirror, quill.Quill)
  def component(element: js.Dynamic): Option[Component] =
    adapters.iterator.map(a => Component(a, a.detect(element))).find(c => exists(c.root))
  def snapshot(element: js.Dynamic): String = component(element).map(c => c.adapter.snapshot(c.root)).getOrElse("")
  def surface(root: js.Dynamic, selector: String): String =
    val node = if bool(root.matches(selector)) then root else root.querySelector(selector)
    (if exists(node) then str(node.textContent) else "") + "\u0000"
