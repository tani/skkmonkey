package skk

enum Mode:
  case Ascii, Hiragana, Katakana, Fullwidth
enum Phase:
  case Direct, Reading, Okuri, Candidate
final case class Registration(key: String, reading: String)
final case class Result(handled: Boolean, committed: String, registration: Option[Registration] = None)

// Synchronous state machine: DOM and persistence belong to the browser layer.
final class Engine(val dictionary: Dictionary):
  var mode = Mode.Ascii
  var phase = Phase.Direct
  var reading = ""
  var okuri = ""
  var okuriCode = ""
  var abbrev = false
  val romaji = new Romaji
  var candidates = Vector.empty[Candidate]
  var index = 0
  private var output = ""
  private var request: Option[Registration] = None
  def key: String = reading + okuriCode
  def active: Boolean = phase != Phase.Direct || romaji.pending.nonEmpty
  def display(text: String): String = if mode == Mode.Katakana then Kana.katakana(text) else text
  def preedit: String = phase match
    case Phase.Candidate => "▼" + candidates.lift(index).map(_.text).getOrElse("") + display(okuri)
    case Phase.Direct => romaji.pending
    case _ => "▽" + display(reading) + (if okuriCode.nonEmpty then "*" + display(okuri) else "") + romaji.pending
  def reset(): Unit =
    phase = Phase.Direct
    reading = ""
    okuri = ""
    okuriCode = ""
    abbrev = false
    romaji.pending = ""
    candidates = Vector.empty
    index = 0
  def setMode(next: Mode): String =
    val committed = finish()
    mode = next
    committed
  def finish(): String =
    val tail = romaji.flush()
    val text =
      if phase == Phase.Candidate then
        val candidate = candidates(index)
        dictionary.learn(key, candidate.text)
        candidate.text + display(okuri)
      else display(reading + okuri + tail)
    reset()
    text
  def register(text: String): String =
    if !Dictionary.validText(text) then ""
    else
      dictionary.learn(key, text)
      val result = text + display(okuri)
      reset()
      result
  private def append(text: String): Unit = phase match
    case Phase.Direct => output += display(text)
    case Phase.Okuri => okuri += text
    case _ => reading += text
  private def requestRegistration(): Unit =
    request = Some(Registration(key, display(reading + okuri)))
  private def convert(): Unit =
    append(romaji.flush())
    if reading.nonEmpty then
      if okuri.nonEmpty then okuriCode = Kana.okuriLetter(okuri, okuriCode)
      candidates = dictionary.lookup(key)
      if candidates.isEmpty then requestRegistration()
      else
        phase = Phase.Candidate
        index = 0
  private def backToReading(): Unit =
    phase = if okuriCode.nonEmpty then Phase.Okuri else Phase.Reading
    candidates = Vector.empty
  def handle(key: String): Result =
    output = ""
    request = None
    val handled = process(key)
    Result(handled, output, request)
  private def process(input: String): Boolean =
    var key = input
    if key == "C-j" then
      output += setMode(Mode.Hiragana)
      return true
    if key == "C-g" || key == "Escape" then
      if !active then return false
      if phase == Phase.Candidate then backToReading() else reset()
      return true
    if mode == Mode.Ascii then return false
    if key == "Backspace" || key == "C-h" then
      if !active then return false
      if phase == Phase.Candidate then backToReading()
      else if romaji.pending.nonEmpty then romaji.pending = romaji.pending.dropRight(1)
      else if okuri.nonEmpty then okuri = Kana.dropLast(okuri)
      else if okuriCode.nonEmpty then
        okuriCode = ""
        phase = Phase.Reading
      else if reading.nonEmpty then reading = Kana.dropLast(reading)
      else reset()
      return true
    if key == "Enter" then
      if !active then return false
      output += finish()
      return true
    if phase == Phase.Candidate then
      if key == " " then
        if index + 1 < candidates.length then index += 1 else requestRegistration()
        return true
      if key == "x" then
        if index > 0 then index -= 1 else backToReading()
        return true
      if key.length != 1 then return false
      output += finish()
    if key.length != 1 then return false
    if mode == Mode.Fullwidth then
      output += Kana.fullwidth(key)
      return true
    if abbrev then
      if key == " " then convert() else reading += key
      return true
    val commandBoundary = romaji.pending.isEmpty || romaji.pending == "n"
    if key == " " && romaji.pending != "z" then
      if phase != Phase.Direct then convert()
      else
        append(romaji.flush())
        output += " "
      return true
    if commandBoundary && key == "q" then
      append(romaji.flush())
      if phase != Phase.Direct then
        output += (if mode == Mode.Katakana then reading + okuri else Kana.katakana(reading + okuri))
        reset()
      else mode = if mode == Mode.Hiragana then Mode.Katakana else Mode.Hiragana
      return true
    if commandBoundary && phase == Phase.Direct && (key == "l" || key == "L") then
      append(romaji.flush())
      mode = if key == "l" then Mode.Ascii else Mode.Fullwidth
      return true
    if commandBoundary && phase == Phase.Direct && key == "/" then
      append(romaji.flush())
      phase = Phase.Reading
      abbrev = true
      return true
    if key == ";" && commandBoundary then
      append(romaji.flush())
      if phase == Phase.Direct then phase = Phase.Reading
      return true
    // Late Shift release completes the current syllable: KAKu = KaKu, YOI = YoI.
    // At a completed stem boundary start okuri; pending n flushes (ShinDa),
    // whereas initial NI must still complete に rather than starting okuri.
    if key.head >= 'A' && key.head <= 'Z' then
      if phase == Phase.Direct then
        append(romaji.flush())
        phase = Phase.Reading
      else if phase == Phase.Reading && reading.nonEmpty && commandBoundary then
        append(romaji.flush())
        phase = Phase.Okuri
        okuriCode = key.toLowerCase
      key = key.toLowerCase
    append(romaji.feed(key))
    if phase == Phase.Okuri && okuri.nonEmpty && romaji.pending.isEmpty then convert()
    true
