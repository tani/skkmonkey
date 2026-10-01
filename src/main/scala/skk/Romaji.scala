package skk

final class Romaji:
  var pending = ""
  private val prefixes = KanaTable.rules.keysIterator.flatMap(k => (1 until k.length).map(k.take)).toSet
  def feed(char: String): String =
    pending += char
    val out = new StringBuilder
    var done = false
    while pending.nonEmpty && !done do
      KanaTable.rules.get(pending) match
        case Some((kana, rest)) if !prefixes(pending) =>
          out.append(kana)
          pending = rest
          done = true
        case _ if prefixes(pending) => done = true
        case _ if pending.startsWith("n") =>
          out.append("ん")
          pending = pending.drop(1)
        case _ =>
          out.append(pending.take(1))
          pending = pending.drop(1)
    out.toString
  def flush(): String =
    val result = if pending == "n" then "ん" else pending
    pending = ""
    result

object Kana:
  def katakana(text: String): String = text.map(c => if c >= 'ぁ' && c <= 'ゖ' then (c.toInt + 0x60).toChar else c)
  def fullwidth(text: String): String = text.map:
    case ' ' => '　'
    case c if c >= '!' && c <= '~' => (c.toInt + 0xfee0).toChar
    case c => c
  // Derived, altered skkeleton okuri data; see LICENSE.skkeleton.
  private val okuri = Map(
    "ぁ" -> "x",
    "あ" -> "a",
    "ぃ" -> "x",
    "い" -> "i",
    "ぅ" -> "x",
    "う" -> "u",
    "ぇ" -> "x",
    "え" -> "e",
    "ぉ" -> "x",
    "お" -> "o",
    "か" -> "k",
    "が" -> "g",
    "き" -> "k",
    "ぎ" -> "g",
    "く" -> "k",
    "ぐ" -> "g",
    "け" -> "k",
    "げ" -> "g",
    "こ" -> "k",
    "ご" -> "g",
    "さ" -> "s",
    "ざ" -> "z",
    "し" -> "s",
    "じ" -> "j",
    "す" -> "s",
    "ず" -> "z",
    "せ" -> "s",
    "ぜ" -> "z",
    "そ" -> "s",
    "ぞ" -> "z",
    "た" -> "t",
    "だ" -> "d",
    "ち" -> "t",
    "ぢ" -> "d",
    "っ" -> "x",
    "つ" -> "t",
    "づ" -> "d",
    "て" -> "t",
    "で" -> "d",
    "と" -> "t",
    "ど" -> "d",
    "な" -> "n",
    "に" -> "n",
    "ぬ" -> "n",
    "ね" -> "n",
    "の" -> "n",
    "は" -> "h",
    "ば" -> "b",
    "ぱ" -> "p",
    "ひ" -> "h",
    "び" -> "b",
    "ぴ" -> "p",
    "ふ" -> "h",
    "ぶ" -> "b",
    "ぷ" -> "p",
    "へ" -> "h",
    "べ" -> "b",
    "ぺ" -> "p",
    "ほ" -> "h",
    "ぼ" -> "b",
    "ぽ" -> "p",
    "ま" -> "m",
    "み" -> "m",
    "む" -> "m",
    "め" -> "m",
    "も" -> "m",
    "ゃ" -> "x",
    "や" -> "y",
    "ゅ" -> "x",
    "ゆ" -> "y",
    "ょ" -> "x",
    "よ" -> "y",
    "ら" -> "r",
    "り" -> "r",
    "る" -> "r",
    "れ" -> "r",
    "ろ" -> "r",
    "ゎ" -> "x",
    "わ" -> "w",
    "ゐ" -> "x",
    "ゑ" -> "x",
    "を" -> "w",
    "ん" -> "n"
  )
  def okuriLetter(text: String, fallback: String): String =
    if text == "っ" then "t"
    else text.find(_ != 'っ').flatMap(c => okuri.get(c.toString)).getOrElse(fallback)
  // Delete one Unicode code point, including supplementary characters.
  def dropLast(text: String): String =
    if text.isEmpty then text
    else if text.length >= 2 && Character.isLowSurrogate(text.last) && Character.isHighSurrogate(text(text.length - 2))
    then text.dropRight(2)
    else text.dropRight(1)
