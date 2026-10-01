export interface Candidate {
  text: string;
  annotation?: string;
}
export type UserEntries = Record<string, string[]>;

// SKK allows Lisp expressions in dictionaries; this implementation treats those
// entries as unsupported data. It never evaluates dictionary content.
export function parseSkk(text: string): Map<string, Candidate[]> {
  const entries = new Map<string, Candidate[]>();
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (line.startsWith(';') || !line.trim()) continue;
    const match = /^(\S+)\s+\/(.*)\/$/.exec(line);
    if (!match) continue;
    const candidates: Candidate[] = [];
    let block = false;
    for (const token of match[2]!.split('/')) {
      if (token.startsWith('[')) {
        block = true;
        continue;
      }
      if (block) {
        if (token.endsWith(']')) block = false;
        continue;
      }
      if (!token || token.startsWith('(')) continue;
      const semicolon = token.indexOf(';');
      const item =
        semicolon < 0
          ? { text: token }
          : { text: token.slice(0, semicolon), annotation: token.slice(semicolon + 1) };
      if (item.text && !candidates.some((c) => c.text === item.text)) candidates.push(item);
    }
    if (candidates.length) {
      const previous = entries.get(match[1]!) ?? [];
      entries.set(match[1]!, [
        ...previous,
        ...candidates.filter((c) => !previous.some((p) => p.text === c.text)),
      ]);
    }
  }
  return entries;
}

export function validUserEntries(value: unknown): UserEntries {
  const result: UserEntries = Object.create(null) as UserEntries;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return result;
  for (const [key, entries] of Object.entries(value)) {
    if (!/^[^\s/;]+$/.test(key) || !Array.isArray(entries)) continue;
    result[key] = entries
      .filter(
        (x): x is string =>
          typeof x === 'string' && x.length > 0 && x.length <= 1000 && !/[\r\n/;]/.test(x),
      )
      .slice(0, 100);
  }
  return result;
}

export class Dictionary {
  base = new Map<string, Candidate[]>();
  user: UserEntries = Object.create(null) as UserEntries;
  revision = 0;
  constructor(text = '', user: unknown = {}) {
    this.base = parseSkk(text);
    this.user = validUserEntries(user);
  }
  lookup(key: string): Candidate[] {
    const user = this.user[key] ?? [];
    return [
      ...user.map((text) => ({ text })),
      ...(this.base.get(key) ?? []).filter((c) => !user.includes(c.text)),
    ];
  }
  learn(key: string, text: string): void {
    if (!text || /[\r\n/;]/.test(text) || text.length > 1000 || !/^[^\s/;]+$/.test(key)) return;
    if (this.user[key]?.[0] === text) return;
    this.user[key] = [text, ...(this.user[key] ?? []).filter((c) => c !== text)].slice(0, 100);
    this.revision++;
  }
  exportUser(): string {
    return (
      ';; SKK userscript personal dictionary (UTF-8)\n' +
      Object.entries(this.user)
        .map(([key, values]) => `${key} /${values.join('/')}/`)
        .join('\n') +
      '\n'
    );
  }
}
