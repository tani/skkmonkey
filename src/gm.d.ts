declare function GM_getValue<T>(key: string, fallback: T): T | Promise<T>;
declare function GM_setValue(key: string, value: unknown): void | Promise<void>;
declare function GM_registerMenuCommand(label: string, callback: () => void): unknown;
declare function GM_getResourceURL(name: string, isBlobUrl?: boolean): string | Promise<string>;
