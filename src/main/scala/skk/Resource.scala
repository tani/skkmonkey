package skk

import scala.scalajs.js
import scala.concurrent.Future
import scala.scalajs.concurrent.JSExecutionContext.Implicits.queue
import Browser.*

object Resource:
  def load(getURL: () => js.Any = () => GM.GM_getResourceURL("SKK_JISYO_L", false)): Future[Option[Dictionary]] =
    call[String](getURL()).flatMap: url =>
      val bytes: Future[js.Any] =
        if url.matches("(?s)^data:[^,]*;base64,.*$") then
          try
            val binary = global.atob(url.substring(url.indexOf(',') + 1)).asInstanceOf[String]
            val data = js.Dynamic.newInstance(global.Uint8Array)(binary.length)
            binary.indices.foreach(i => data.updateDynamic(i.toString)(binary.charAt(i).toInt))
            Future.successful(data)
          catch case e: Throwable => Future.failed(e)
        else if url.startsWith("blob:") || url.startsWith("data:") then
          call[js.Dynamic](global.fetch(url, obj("signal" -> global.AbortSignal.timeout(5000)))).flatMap: response =>
            if !bool(response.ok) then Future.failed(new Exception("Cannot read cached dictionary resource"))
            else call[js.Any](response.arrayBuffer())
        else Future.failed(new Exception("Missing cached dictionary resource"))
      bytes.map: data =>
        val dictionary = new Dictionary(decode(data, "euc-jp"))
        if dictionary.base.isEmpty then throw new Exception("Empty dictionary resource")
        Some(dictionary)
    .recover: error =>
      global.console.warn("SKK-JISYO.L resource unavailable; using starter dictionary:", error.toString)
      None
