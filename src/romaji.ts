import { kanaTable } from './kana-table.ts';

const rules = new Map(kanaTable);
const prefixes = new Set(kanaTable.flatMap(([key]) =>
  Array.from({ length: key.length - 1 }, (_, i) => key.slice(0, i + 1))));

export class Romaji {
  pending = '';
  feed(char: string): string {
    this.pending += char;
    let out = '';
    while (this.pending) {
      const exact = rules.get(this.pending);
      if (exact && !prefixes.has(this.pending)) {
        out += exact[0];
        this.pending = exact[1];
        break;
      }
      if (prefixes.has(this.pending)) break;
      // A delayed n is finalized before a consonant, punctuation, or boundary.
      if (this.pending.startsWith('n')) {
        out += 'ん';
        this.pending = this.pending.slice(1);
        continue;
      }
      // Preserve unrecognized input rather than silently deleting it.
      out += this.pending[0];
      this.pending = this.pending.slice(1);
    }
    return out;
  }
  flush(): string {
    const result = this.pending === 'n' ? 'ん' : this.pending;
    this.pending = '';
    return result;
  }
}

export function katakana(text: string): string {
  return text.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

export function fullwidth(text: string): string {
  return text.replace(/[!-~ ]/g, c => c === ' ' ? '　' : String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}
