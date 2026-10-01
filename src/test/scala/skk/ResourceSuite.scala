package skk

import scala.scalajs.js
import scala.scalajs.concurrent.JSExecutionContext.Implicits.queue
import Browser.*

final class ResourceSuite extends munit.FunSuite:
  private val url = "data:text/plain;base64,pLikt6TnIC+8rb3xLwo="
  test("EUC-JP data resource, asynchronous GM API, no fetch"):
    val fetch = global.fetch
    global.fetch = ((_: js.Any) => throw new Exception("Must not fetch")): js.Function1[js.Any, js.Any]
    Resource.load(() => js.Promise.resolve(url)).map: dictionary =>
      assertEquals(dictionary.get.lookup("じしょ").head.text, "辞書")
    .andThen { case _ => global.fetch = fetch }
  test("blob resource loads locally"):
    val bytes = js.Dynamic.newInstance(global.Uint8Array)(js.Array(0xa4, 0xb8, 0xa4, 0xb7, 0xa4, 0xe7,
      0x20, 0x2f, 0xbc, 0xad, 0xbd, 0xf1, 0x2f, 0x0a))
    val blob = js.Dynamic.newInstance(global.Blob)(js.Array(bytes))
    val blobURL = global.URL.createObjectURL(blob).asInstanceOf[String]
    Resource.load(() => blobURL).map: dictionary =>
      assertEquals(dictionary.get.lookup("じしょ").head.text, "辞書")
    .andThen { case _ => global.URL.revokeObjectURL(blobURL) }
  test("missing, malformed, invalid EUC-JP and empty resources fall back"):
    val fetch = global.fetch
    global.fetch = ((_: js.Any) => throw new Exception("Must not fetch remote")): js.Function1[js.Any, js.Any]
    val urls = Vector("", "https://example.com/dictionary", "data:text/plain;base64,!",
      "data:text/plain;base64,/w==", "data:text/plain;base64,")
    // Sequential to keep the global fetch stub scoped to this test.
    val result = urls.foldLeft(scala.concurrent.Future.successful(())): (previous, value) =>
      previous.flatMap(_ => Resource.load(() => value).map(d => assertEquals(d, None)))
    result.flatMap(_ => Resource.load(() => throw new Exception("Missing")).map(d => assertEquals(d, None)))
      .andThen { case _ => global.fetch = fetch }
  test("import priority, missing candidates and personal learning"):
    val d = new Dictionary("", js.Dynamic.literal("じしょ" -> js.Array("学習")))
    d.base = Dictionary.merge(
      new Dictionary("じしょ /取込/辞書/"),
      new Dictionary("じしょ /辞書;annotation/字書/\nしげん /資源/"))
    assertEquals(d.lookup("じしょ").map(_.text), Vector("学習", "取込", "辞書", "字書"))
    assertEquals(d.lookup("しげん").head.text, "資源")
