package skk

import scala.scalajs.js
import Browser.*
import editors.Registry
import editors.shared.EditContext
import editors.native.{Input, Contenteditable}

final class Bookmark(val editor: js.Dynamic):
  private val componentState = Registry.snapshot(editor)
  private val context = EditContext.of(editor)
  private val value =
    if exists(context) then str(context.text)
    else if Input.is(editor) then str(editor.value)
    else str(editor.textContent)
  private val start =
    if exists(context) then int(context.selectionStart)
    else if Input.is(editor) && exists(editor.selectionStart) then int(editor.selectionStart) else 0
  private val end =
    if exists(context) then int(context.selectionEnd)
    else if Input.is(editor) && exists(editor.selectionEnd) then int(editor.selectionEnd) else start
  private val range: js.Dynamic =
    if exists(context) || Input.is(editor) then null
    else
      val selection = Contenteditable.selection(editor)
      if exists(selection) && int(selection.rangeCount) > 0 then
        val selected = selection.getRangeAt(0)
        if bool(editor.contains(selected.commonAncestorContainer)) then selected.cloneRange() else null
      else null
  def valid(): Boolean =
    if !bool(editor.isConnected) || Registry.snapshot(editor) != componentState then return false
    val context = EditContext.of(editor)
    if exists(context) then
      return str(context.text) == value && int(context.selectionStart) == start && int(context.selectionEnd) == end
    if Input.is(editor) then
      return !bool(editor.disabled) && !bool(editor.readOnly) && str(editor.value) == value &&
        int(editor.selectionStart) == start && int(editor.selectionEnd) == end
    if !bool(editor.isContentEditable) || str(editor.textContent) != value || !exists(range) then return false
    val selection = Contenteditable.selection(editor)
    if !exists(selection) || int(selection.rangeCount) == 0 then return false
    val current = selection.getRangeAt(0)
    current.startContainer == range.startContainer && current.startOffset == range.startOffset &&
      current.endContainer == range.endContainer && current.endOffset == range.endOffset
  def restoreFocus(): Boolean =
    if !bool(editor.isConnected) then return false
    val component = Registry.component(editor)
    if component.nonEmpty && Registry.snapshot(editor).takeWhile(_ != '\u0000') != componentState.takeWhile(_ != '\u0000')
    then return false
    val context = EditContext.of(editor)
    if exists(context) then
      if str(context.text) != value then return false
      editor.focus()
      context.updateSelection(start, end)
      return true
    if Input.is(editor) then
      if bool(editor.disabled) || bool(editor.readOnly) || (component.isEmpty && str(editor.value) != value) then return false
      editor.focus()
      editor.setSelectionRange(start, end)
      return true
    if !bool(editor.isContentEditable) || str(editor.textContent) != value || !exists(range) ||
      !bool(range.startContainer.isConnected) || !bool(range.endContainer.isConnected) then return false
    editor.focus()
    val selection = Contenteditable.selection(editor)
    if exists(selection) then
      selection.removeAllRanges()
      selection.addRange(range.cloneRange())
    editor.ownerDocument.dispatchEvent(event("selectionchange"))
    true
  def insert(text: String): Boolean =
    if !valid() then return false
    if text.isEmpty then return true
    // Cancelable beforeinput lets the page veto; stale bookmarks never write.
    if !bool(editor.dispatchEvent(inputEvent("beforeinput", text, true))) || !valid() then return false
    Registry.component(editor) match
      case Some(component) => component.adapter.insert(editor, text)
      case None if Input.is(editor) => Input.insert(editor, text)
      case None => Contenteditable.insert(editor, text, range)
