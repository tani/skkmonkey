package skk.editors.native

import scala.scalajs.js
import skk.Browser.*
import skk.editors.Registry
import skk.editors.shared.EditContext

object FindEditor:
  def apply(path: js.Array[js.Dynamic]): js.Dynamic =
    if path.exists(n => instance(n, global.HTMLElement) && bool(n.matches("[data-skk-disable]"))) then return null
    val nodes = path.iterator.filter(n => instance(n, global.HTMLElement))
    while nodes.hasNext do
      val node = nodes.next()
      if exists(node.closest("[data-skk-disable]")) then return null
      val monaco = Registry.component(node).exists(_.kind == "monaco")
      if monaco && str(node.getAttribute("aria-autocomplete")) == "none" then return null
      if instance(node, global.HTMLTextAreaElement) then
        return if bool(node.disabled) || bool(node.readOnly) then null else node
      if instance(node, global.HTMLInputElement) then
        return if Set("text", "search")(str(node.`type`)) && !bool(node.disabled) && !bool(node.readOnly) then node else null
      if exists(node.closest("[contenteditable=\"false\"]")) then return null
      if exists(EditContext.of(node)) && monaco then return node
      if bool(node.isContentEditable) then
        var root = node
        while exists(root.parentElement) && bool(root.parentElement.isContentEditable) do root = root.parentElement
        return root
    null
