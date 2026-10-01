package skk.editors.monaco

import scala.scalajs.js
import skk.Browser.*
import skk.editors.native.Input

object Textarea:
  def insert(element: js.Dynamic, text: String): Boolean =
    instance(element, global.HTMLTextAreaElement) && Input.insert(element, text)
