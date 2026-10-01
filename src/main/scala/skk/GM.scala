package skk

import scala.scalajs.js
import scala.scalajs.js.annotation.JSGlobalScope

// Managers may supply grants as lexical wrapper bindings instead of properties
// of window/globalThis. Emit bare GM_* identifiers so both injection styles work.
@js.native
@JSGlobalScope
object GM extends js.Object:
  def GM_getResourceURL(name: String, isBlobURL: Boolean): js.Any = js.native
  def GM_getValue(key: String, fallback: js.Any): js.Any = js.native
  def GM_setValue(key: String, value: js.Any): js.Any = js.native
  def GM_registerMenuCommand(label: String, callback: js.Function0[Unit]): js.Any = js.native
