package skk

import scala.scalajs.js

final class EngineSuite extends munit.FunSuite:
  private def make(): Engine =
    val engine = new Engine(new Dictionary(StarterDictionary.text))
    engine.handle("C-j")
    engine
  private def typeKeys(engine: Engine, text: String): String =
    text.iterator.map(c => engine.handle(c.toString).committed).mkString

  test("direct kana, nasal boundaries, small kana, doubled consonants and symbols"):
    assertEquals(typeKeys(make(), "kon'nichihasekai.gakkouxya n'ya zhz "), "こんにちはせかい。がっこうゃ んや ←　")
  test("romaji preserves invalid sequences and finalizes n"):
    val r = new Romaji
    assertEquals(r.feed("n"), "")
    assertEquals(r.feed("k"), "ん")
    assertEquals(r.feed("a"), "か")
    assertEquals(r.feed("@"), "@")
    r.feed("n")
    assertEquals(r.flush(), "ん")
  test("candidate navigation, confirmation and learning"):
    val e = make()
    assertEquals(typeKeys(e, "Kanji"), "")
    assertEquals(e.preedit, "▽かんじ")
    e.handle(" ")
    assertEquals(e.preedit, "▼漢字")
    e.handle(" ")
    assertEquals(e.preedit, "▼感じ")
    e.handle("x")
    assertEquals(e.preedit, "▼漢字")
    e.handle(" ")
    assertEquals(e.handle("Enter").committed, "感じ")
    assertEquals(e.phase, Phase.Direct)
    typeKeys(e, "Kanji ")
    assertEquals(e.preedit, "▼感じ")
  test("candidate commits before ordinary typing"):
    val e = make()
    typeKeys(e, "Nihon ")
    assertEquals(typeKeys(e, "go"), "日本ご")
    assertEquals(e.preedit, "")
  test("automatic okuri and canonical consonants"):
    val e = make()
    typeKeys(e, "KaKu")
    assertEquals(e.key, "かk")
    assertEquals(e.preedit, "▼書く")
    assertEquals(e.handle("Enter").committed, "書く")
    typeKeys(e, "TabeRu")
    assertEquals(e.preedit, "▼食べる")
    assertEquals(e.handle("Enter").committed, "食べる")
    e.dictionary.base("まt") = Vector(Candidate("待"))
    typeKeys(e, "MaChi")
    assertEquals(e.key, "まt")
    assertEquals(e.handle("Enter").committed, "待ち")
  test("late Shift release completes syllables before starting okuri"):
    val e = make()
    Vector("XX", "KA", "YO", "NI", "SHI", "KAnji").foreach: text =>
      text.foreach: c =>
        val result = e.handle(c.toString)
        assertEquals(result.registration, None)
        assertEquals(result.committed, "")
        assertEquals(e.phase, Phase.Reading)
        assertEquals(e.okuriCode, "")
      e.handle("Escape")
    typeKeys(e, "KAnji ")
    assertEquals(e.preedit, "▼漢字")
    e.handle("Enter")
    Vector("KaKu", "KAKu", "KAKU").foreach: text =>
      typeKeys(e, text)
      assertEquals(e.preedit, "▼書く")
      assertEquals(e.handle("Enter").committed, "書く")
    e.dictionary.base("よi") = Vector(Candidate("良"))
    Vector("YoI", "YOI").foreach: text =>
      typeKeys(e, text)
      assertEquals(e.key, "よi")
      assertEquals(e.preedit, "▼良い")
      assertEquals(e.handle("Enter").committed, "良い")
    e.dictionary.base("しn") = Vector(Candidate("死"))
    typeKeys(e, "SHINu")
    assertEquals(e.preedit, "▼死ぬ")
    e.handle("Enter")
    typeKeys(e, "TAbeRu")
    assertEquals(e.preedit, "▼食べる")
    e.handle("Enter")
    typeKeys(e, ";kaKu")
    assertEquals(e.preedit, "▼書く")
    e.handle("Enter")
    typeKeys(e, "/HTTP ")
    assert(e.abbrev)
    assertEquals(e.reading, "HTTP")
  test("uppercase handling survives confirmation, cancellation and mode changes"):
    val e = make()
    Vector("Enter", "Escape", "C-j").foreach: end =>
      typeKeys(e, "Ka")
      e.handle(end)
      typeKeys(e, "KA")
      assertEquals(e.preedit, "▽か")
      e.handle("Escape")
    typeKeys(e, "KaKu")
    assertEquals(e.preedit, "▼書く")
  test("nasal before uppercase okuri and doubled okuri consonants"):
    val e = make()
    e.dictionary.base("しんd") = Vector(Candidate("死ん"))
    typeKeys(e, "ShinDa")
    assertEquals(e.preedit, "▼死んだ")
    e.handle("Enter")
    e.dictionary.base("おくt") = Vector(Candidate("送"))
    typeKeys(e, "OkuTta")
    assertEquals(e.preedit, "▼送った")
  test("cancel candidate retains reading; cancel reading discards"):
    val e = make()
    typeKeys(e, "Nihon ")
    e.handle("C-g")
    assertEquals(e.preedit, "▽にほん")
    assertEquals(e.handle("C-g").committed, "")
    assert(!e.active)
  test("backspace crosses romaji, reading and okuri boundaries"):
    val e = make()
    typeKeys(e, "Kak")
    e.handle("Backspace")
    assertEquals(e.preedit, "▽か")
    e.handle("Backspace")
    assertEquals(e.preedit, "▽")
    e.handle("Backspace")
    assert(!e.active)
    typeKeys(e, "KaKu")
    e.handle("Backspace")
    assertEquals(e.phase, Phase.Okuri)
    e.handle("Backspace")
    assertEquals(e.okuri, "")
    e.handle("Backspace")
    assertEquals(e.phase, Phase.Reading)
  test("q switches modes or confirms opposite kana"):
    val e = make()
    assertEquals(typeKeys(e, "qkatakana"), "カタカナ")
    assertEquals(typeKeys(e, "qkana"), "かな")
    typeKeys(e, "Nihonq")
    assertEquals(e.phase, Phase.Direct)
    assertEquals(e.mode, Mode.Hiragana)
    typeKeys(e, "Nihon")
    assertEquals(e.handle("q").committed, "ニホン")
  test("ASCII, fullwidth, abbreviation and reactivation"):
    val e = make()
    e.handle("l")
    assert(!e.handle("a").handled)
    e.handle("C-j")
    e.handle("L")
    assertEquals(typeKeys(e, "Ab 12"), "Ａｂ　１２")
    e.handle("C-j")
    typeKeys(e, "/skk ")
    assertEquals(e.handle("Enter").committed, "SKK")
  test("registration preserves reading and okuri and persists words"):
    val e = make()
    typeKeys(e, "Michi ")
    assertEquals(e.handle(" ").registration.map(_.key), Some("みち"))
    assertEquals(e.register("道"), "道")
    typeKeys(e, "Michi ")
    assertEquals(e.preedit, "▼道")
    e.handle("Enter")
    typeKeys(e, "NeMu")
    assertEquals(e.handle(" ").registration.map(_.key), Some("ねm"))
    assertEquals(e.register("眠"), "眠む")
    assertEquals(e.dictionary.lookup("ねm").head.text, "眠")
  test("Enter commits n; idle Enter and Escape belong to page"):
    val e = make()
    typeKeys(e, "n")
    assertEquals(e.handle("Enter").committed, "ん")
    assert(!e.handle("Enter").handled)
    assert(!e.handle("Escape").handled)
  test("parser handles annotations, BOM, CRLF and duplicates"):
    val d = Dictionary.parse("\uFEFF;; comment\r\nかな /仮名;annotation/かな/\r\nかな /仮名/カナ/\n")
    assertEquals(d("かな"), Vector(Candidate("仮名", "annotation"), Candidate("かな"), Candidate("カナ")))
  test("Lisp expressions and okuri blocks are skipped"):
    assertEquals(Dictionary.parse("かk /書/描/[く/書/]/(concat \"evil\")/\n")("かk"),
      Vector(Candidate("書"), Candidate("描")))
  test("personal validation, prototype keys and export round trip"):
    val input = js.Dynamic.literal("safe" -> js.Array[js.Any]("安全", "bad/word", null), "bad" -> "bad")
    assertEquals(Dictionary.validateUser(input).toMap, Map("safe" -> Vector("安全")))
    val d = new Dictionary
    d.learn("__proto__", "安全")
    d.learn("かな", "仮名")
    d.learn("かな", "かな")
    d.learn("かな", "仮名")
    d.learn("bad key", "ignored")
    val imported = new Dictionary(d.exportUser())
    assertEquals(imported.lookup("かな").head.text, "仮名")
    assertEquals(imported.lookup("__proto__").head.text, "安全")
    assertEquals(new Dictionary("", d.snapshot()).user.toMap, d.user.toMap)
  test("supplementary Unicode backspace removes one code point"):
    val e = make()
    e.phase = Phase.Reading
    e.reading = "かな😀"
    e.handle("Backspace")
    assertEquals(e.reading, "かな")
  test("invalid and overlong registration is rejected"):
    val e = make()
    typeKeys(e, "Michi ")
    Vector("", "bad/word", "bad;annotation", "\n", "x" * 1001).foreach: text =>
      assertEquals(e.register(text), "")
      assertEquals(e.reading, "みち")
