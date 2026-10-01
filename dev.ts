// Userscript-manager API shims are confined to the Vite development page.
const values = new Map<string, unknown>();
globalThis.GM_getValue = <T>(key: string, fallback: T): T =>
  values.has(key) ? (values.get(key) as T) : fallback;
globalThis.GM_setValue = (key: string, value: unknown): void => {
  values.set(key, value);
};
globalThis.GM_getResourceURL = (): string => '';
globalThis.GM_registerMenuCommand = (label: string, callback: () => void): unknown => {
  const button = document.createElement('button');
  button.textContent = label;
  button.addEventListener('click', callback);
  document.querySelector('#menu')?.append(button);
  return button;
};
await import('./src/userscript.ts');

export {};
