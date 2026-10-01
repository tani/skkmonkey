import { Dictionary, type Candidate } from './dictionary.ts';

// SKK-JISYO.L is EUC-JP. GM_getResourceText would decode it as UTF-8 in
// some managers, so preserve the cached resource bytes instead.
export async function loadResourceDictionary(getResourceURL: (name: string, isBlobUrl?: boolean) => string | Promise<string> =
  (name, isBlobUrl) => GM_getResourceURL(name, isBlobUrl)): Promise<Dictionary | null> {
  try {
    const url = await getResourceURL('SKK_JISYO_L', false);
    let bytes: Uint8Array;
    const data = /^data:[^,]*;base64,(.*)$/s.exec(url);
    if (data) {
      const binary = atob(data[1]!);
      bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    } else {
      if (!url.startsWith('blob:') && !url.startsWith('data:')) throw new Error('Missing cached dictionary resource');
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Cannot read cached dictionary resource');
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    const dictionary = new Dictionary(new TextDecoder('euc-jp', { fatal: true }).decode(bytes));
    if (!dictionary.base.size) throw new Error('Empty dictionary resource');
    return dictionary;
  } catch (error) {
    console.warn('SKK-JISYO.L resource unavailable; using starter dictionary:', error);
    return null;
  }
}

// Higher-priority dictionaries keep their candidate order; other dictionaries
// still contribute missing entries and candidates.
export function mergeDictionaries(...dictionaries: Dictionary[]): Map<string, Candidate[]> {
  const base = new Map<string, Candidate[]>();
  for (const dictionary of dictionaries) {
    for (const [key, candidates] of dictionary.base) {
      const previous = base.get(key) ?? [];
      base.set(key, [...previous, ...candidates.filter(candidate => !previous.some(item => item.text === candidate.text))]);
    }
  }
  return base;
}
