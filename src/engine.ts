// SKK removes one Unicode code point; kana have no grapheme-cluster editing here.
/* oxlint-disable typescript/no-misused-spread */
import { Dictionary, type Candidate } from './dictionary.ts';
import { Romaji, katakana, fullwidth } from './romaji.ts';
import { okuriLetter } from './okuri.ts';

export type Mode = 'ascii' | 'hiragana' | 'katakana' | 'fullwidth';
export type Phase = 'direct' | 'reading' | 'okuri' | 'candidate';
export interface Result {
  handled: boolean;
  committed: string;
  registration?: { key: string; reading: string };
}

// Pure, synchronous state machine. DOM and persistence live in separate adapters.
export class Engine {
  mode: Mode = 'ascii';
  phase: Phase = 'direct';
  reading = '';
  okuri = '';
  okuriCode = '';
  abbrev = false;
  romaji = new Romaji();
  candidates: Candidate[] = [];
  index = 0;
  private output = '';
  private request: Result['registration'];
  readonly dictionary: Dictionary;
  constructor(dictionary: Dictionary) {
    this.dictionary = dictionary;
  }
  get key(): string {
    return this.reading + this.okuriCode;
  }
  get active(): boolean {
    return this.phase !== 'direct' || this.romaji.pending !== '';
  }
  get preedit(): string {
    if (this.phase === 'candidate')
      return '▼' + (this.candidates[this.index]?.text ?? '') + this.display(this.okuri);
    if (this.phase !== 'direct')
      return (
        '▽' +
        this.display(this.reading) +
        (this.okuriCode ? '*' + this.display(this.okuri) : '') +
        this.romaji.pending
      );
    return this.romaji.pending;
  }
  display(text: string): string {
    return this.mode === 'katakana' ? katakana(text) : text;
  }
  reset(): void {
    this.phase = 'direct';
    this.reading = '';
    this.okuri = '';
    this.okuriCode = '';
    this.abbrev = false;
    this.romaji.pending = '';
    this.candidates = [];
    this.index = 0;
  }
  setMode(mode: Mode): string {
    const committed = this.finish();
    this.mode = mode;
    return committed;
  }
  finish(): string {
    const tail = this.romaji.flush();
    let text: string;
    if (this.phase === 'candidate') {
      const candidate = this.candidates[this.index]!;
      this.dictionary.learn(this.key, candidate.text);
      text = candidate.text + this.display(this.okuri);
    } else text = this.display(this.reading + this.okuri + tail);
    this.reset();
    return text;
  }
  register(text: string): string {
    if (!text || /[\r\n/;]/.test(text)) return '';
    this.dictionary.learn(this.key, text);
    const result = text + this.display(this.okuri);
    this.reset();
    return result;
  }
  private append(text: string): void {
    if (this.phase === 'direct') this.output += this.display(text);
    else if (this.phase === 'okuri') this.okuri += text;
    else this.reading += text;
  }
  private convert(): void {
    this.append(this.romaji.flush());
    if (!this.reading) return;
    if (this.okuri) this.okuriCode = okuriLetter(this.okuri, this.okuriCode);
    this.candidates = this.dictionary.lookup(this.key);
    if (!this.candidates.length) {
      this.request = { key: this.key, reading: this.display(this.reading + this.okuri) };
      return;
    }
    this.phase = 'candidate';
    this.index = 0;
  }
  handle(key: string): Result {
    this.output = '';
    this.request = undefined;
    const handled = this.process(key);
    return {
      handled,
      committed: this.output,
      ...(this.request ? { registration: this.request } : {}),
    };
  }
  private process(key: string): boolean {
    if (key === 'C-j') {
      this.output += this.setMode('hiragana');
      return true;
    }
    if (key === 'C-g' || key === 'Escape') {
      if (!this.active) return false;
      if (this.phase === 'candidate') {
        this.phase = this.okuriCode ? 'okuri' : 'reading';
        this.candidates = [];
      } else this.reset();
      return true;
    }
    if (this.mode === 'ascii') return false;
    if (key === 'Backspace' || key === 'C-h') {
      if (!this.active) return false;
      if (this.phase === 'candidate') {
        this.phase = this.okuriCode ? 'okuri' : 'reading';
        this.candidates = [];
      } else if (this.romaji.pending) this.romaji.pending = this.romaji.pending.slice(0, -1);
      else if (this.okuri) this.okuri = [...this.okuri].slice(0, -1).join('');
      else if (this.okuriCode) {
        this.okuriCode = '';
        this.phase = 'reading';
      } else if (this.reading) this.reading = [...this.reading].slice(0, -1).join('');
      else this.reset();
      return true;
    }
    if (key === 'Enter') {
      if (!this.active) return false;
      this.output += this.finish();
      return true;
    }
    if (this.phase === 'candidate') {
      if (key === ' ') {
        if (this.index + 1 < this.candidates.length) this.index++;
        else this.request = { key: this.key, reading: this.display(this.reading + this.okuri) };
        return true;
      }
      if (key === 'x') {
        if (this.index > 0) this.index--;
        else {
          this.phase = this.okuriCode ? 'okuri' : 'reading';
          this.candidates = [];
        }
        return true;
      }
      // Commit a selected candidate before handling the next ordinary character.
      if (key.length !== 1) return false;
      this.output += this.finish();
    }
    if (key.length !== 1) return false;
    if (this.mode === 'fullwidth') {
      this.output += fullwidth(key);
      return true;
    }
    if (this.abbrev) {
      if (key === ' ') this.convert();
      else this.reading += key;
      return true;
    }
    const commandBoundary = !this.romaji.pending || this.romaji.pending === 'n';
    if (key === ' ' && this.romaji.pending !== 'z') {
      if (this.phase !== 'direct') this.convert();
      else {
        this.append(this.romaji.flush());
        this.output += ' ';
      }
      return true;
    }
    if (commandBoundary && key === 'q') {
      this.append(this.romaji.flush());
      if (this.phase !== 'direct') {
        this.output +=
          this.mode === 'katakana'
            ? this.reading + this.okuri
            : katakana(this.reading + this.okuri);
        this.reset();
      } else this.mode = this.mode === 'hiragana' ? 'katakana' : 'hiragana';
      return true;
    }
    if (commandBoundary && this.phase === 'direct' && (key === 'l' || key === 'L')) {
      this.append(this.romaji.flush());
      this.mode = key === 'l' ? 'ascii' : 'fullwidth';
      return true;
    }
    if (commandBoundary && this.phase === 'direct' && key === '/') {
      this.append(this.romaji.flush());
      this.phase = 'reading';
      this.abbrev = true;
      return true;
    }
    if (key === ';' && commandBoundary) {
      this.append(this.romaji.flush());
      if (this.phase === 'direct') this.phase = 'reading';
      return true;
    }
    // A late Shift release must not split an unfinished romaji syllable:
    // KA completes か and YO completes よ, so KAKu behaves like KaKu and
    // YOI like YoI. Start okuri at a syllable boundary, regardless of case
    // history. Pending n may be flushed as ん (ShinDa), but initial N alone
    // is not a reading stem and NI must still complete に.
    if (/^[A-Z]$/.test(key)) {
      if (this.phase === 'direct') {
        this.append(this.romaji.flush());
        this.phase = 'reading';
      } else if (this.phase === 'reading' && this.reading && commandBoundary) {
        this.append(this.romaji.flush());
        this.phase = 'okuri';
        this.okuriCode = key.toLowerCase();
      }
      key = key.toLowerCase();
    }
    const text = this.romaji.feed(key);
    this.append(text);
    // For doubled consonants, wait for the actual okurigana, not just っ.
    if (this.phase === 'okuri' && this.okuri && !this.romaji.pending) this.convert();
    return true;
  }
}
