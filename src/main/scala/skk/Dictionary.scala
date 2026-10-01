package skk

import scala.collection.mutable
import scala.scalajs.js

final case class Candidate(text: String, annotation: String = "")
type Entries = mutable.LinkedHashMap[String, Vector[Candidate]]
type UserEntries = mutable.LinkedHashMap[String, Vector[String]]

object Dictionary:
  private val linePattern = """^(\S+)\s+/(.*)/$""".r
  def validKey(key: String): Boolean = key.nonEmpty && !key.exists(c => c.isWhitespace || "/;".contains(c))
  def validText(text: String): Boolean = text.nonEmpty && text.length <= 1000 && !text.exists("\r\n/;".contains(_))
  // Dictionary expressions are data only; Lisp and okuri blocks are never evaluated.
  def parse(text: String): Entries =
    val entries = mutable.LinkedHashMap.empty[String, Vector[Candidate]]
    text.stripPrefix("\uFEFF").split("\r?\n").foreach:
      case linePattern(key, body) if !key.startsWith(";") =>
        var block = false
        val candidates = Vector.newBuilder[Candidate]
        body.split("/", -1).foreach: token =>
          if token.startsWith("[") then block = true
          else if block then
            if token.endsWith("]") then block = false
          else if token.nonEmpty && !token.startsWith("(") then
            val parts = token.split(";", 2)
            if parts(0).nonEmpty then candidates += Candidate(parts(0), parts.lift(1).getOrElse(""))
        val previous = entries.getOrElse(key, Vector.empty)
        val combined = (previous ++ candidates.result()).distinctBy(_.text)
        if combined.nonEmpty then entries(key) = combined
      case _ => ()
    entries
  def validateUser(value: js.Any): UserEntries =
    val result = mutable.LinkedHashMap.empty[String, Vector[String]]
    if value != null && js.typeOf(value) == "object" && !js.Array.isArray(value) then
      val data = value.asInstanceOf[js.Dictionary[js.Any]]
      js.Object.keys(data.asInstanceOf[js.Object]).foreach: key =>
        val items = data(key)
        if validKey(key) && js.Array.isArray(items) then
          result(key) = items.asInstanceOf[js.Array[js.Any]].iterator
            .filter(v => js.typeOf(v) == "string")
            .map(_.asInstanceOf[String]).filter(validText).take(100).toVector
    result
  def merge(dictionaries: Dictionary*): Entries =
    val base = mutable.LinkedHashMap.empty[String, Vector[Candidate]]
    dictionaries.foreach: dictionary =>
      dictionary.base.foreach: (key, candidates) =>
        base(key) = (base.getOrElse(key, Vector.empty) ++ candidates).distinctBy(_.text)
    base

final class Dictionary(text: String = "", initialUser: js.Any = js.Dynamic.literal()):
  var base: Entries = Dictionary.parse(text)
  val user: UserEntries = Dictionary.validateUser(initialUser)
  var revision = 0
  def lookup(key: String): Vector[Candidate] =
    val learned = user.getOrElse(key, Vector.empty)
    learned.map(Candidate(_)) ++ base.getOrElse(key, Vector.empty).filterNot(c => learned.contains(c.text))
  def learn(key: String, text: String): Unit =
    if Dictionary.validKey(key) && Dictionary.validText(text) && !user.get(key).exists(_.headOption.contains(text)) then
      user(key) = (text +: user.getOrElse(key, Vector.empty).filterNot(_ == text)).take(100)
      revision += 1
  def snapshot(): js.Dictionary[js.Array[String]] =
    // Null prototype preserves even "__proto__" as an ordinary SKK key.
    val data = js.Dynamic.global.Object.create(null).asInstanceOf[js.Dictionary[js.Array[String]]]
    user.foreach((key, words) => data(key) = js.Array(words*))
    data
  def exportUser(): String =
    ";; SKK userscript personal dictionary (UTF-8)\n" +
      user.iterator.map((key, values) => s"$key /${values.mkString("/")}/").mkString("\n") + "\n"
