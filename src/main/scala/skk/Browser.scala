package skk

import scala.scalajs.js
import scala.scalajs.js.JSConverters.*
import scala.concurrent.Future
import scala.scalajs.concurrent.JSExecutionContext.Implicits.queue

// Dynamic interop is confined to browser APIs, EditContext and versioned editor
// hooks. SKK state, dictionaries and adapter selection remain Scala data.
object Browser:
  val global: js.Dynamic = js.Dynamic.global.globalThis
  def document: js.Dynamic = global.document
  def exists(value: js.Any): Boolean = value != null && !js.isUndefined(value)
  def str(value: js.Dynamic, fallback: String = ""): String =
    if exists(value) then value.asInstanceOf[String] else fallback
  def bool(value: js.Dynamic): Boolean = exists(value) && value.asInstanceOf[Boolean]
  def int(value: js.Dynamic): Int = value.asInstanceOf[Int]
  def obj(fields: (String, js.Any)*): js.Dynamic = js.Dynamic.literal(fields*)
  def create(tag: String, text: String = "", cls: String = ""): js.Dynamic =
    val node = document.createElement(tag)
    node.textContent = text
    if cls.nonEmpty then node.className = cls
    node
  def event(kind: String, options: js.Dynamic = obj()): js.Dynamic =
    js.Dynamic.newInstance(global.Event)(kind, options)
  def inputEvent(kind: String, text: String, cancelable: Boolean = false): js.Dynamic =
    js.Dynamic.newInstance(global.InputEvent)(kind, obj("bubbles" -> true, "composed" -> true,
      "cancelable" -> cancelable, "inputType" -> "insertText", "data" -> text))
  def listen(target: js.Dynamic, kind: String, capture: Boolean = false)(fn: js.Dynamic => Unit): Unit =
    target.addEventListener(kind, ((e: js.Dynamic) => fn(e)): js.Function1[js.Dynamic, Unit], capture)
  def delay(ms: Int)(fn: => Unit): js.Dynamic =
    global.setTimeout((() => fn): js.Function0[Unit], ms)
  def frame(fn: => Unit): Unit = global.requestAnimationFrame((() => fn): js.Function0[Unit])
  def promise[A](value: js.Any): Future[A] = js.Promise.resolve(value).asInstanceOf[js.Promise[A]].toFuture
  def call[A](fn: => js.Any): Future[A] =
    try promise[A](fn) catch case e: Throwable => Future.failed(e)
  def decode(bytes: js.Any, encoding: String): String =
    js.Dynamic.newInstance(global.TextDecoder)(encoding, obj("fatal" -> true)).decode(bytes).asInstanceOf[String]
  def instance(node: js.Dynamic, constructor: js.Dynamic): Boolean =
    exists(node) && exists(constructor) && constructor.prototype.isPrototypeOf(node).asInstanceOf[Boolean]
