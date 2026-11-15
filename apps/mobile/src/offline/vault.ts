/**
 * Encrypted local vault. Values are AES-256-GCM encrypted with a per-user key
 * kept in the platform secure store (Android Keystore-backed / iOS Keychain on
 * devices). Ciphertext is written to ordinary app storage. Everything for a
 * user is namespaced and can be destroyed in one call (sign-out, account
 * switch, revoked access) by deleting the key and the ciphertext.
 */
export interface KeyStore {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
const enc = new TextEncoder(),
  dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
function chunkedB64(u: Uint8Array) {
  let out = '';
  for (let i = 0; i < u.length; i += 0x8000)
    out += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(out);
}
export class Vault {
  private key: CryptoKey | null = null;
  constructor(
    private uid: string,
    private keys: KeyStore,
    private kv: KV,
  ) {}
  private get prefix() {
    return `fos:${this.uid}:`;
  }
  private async cryptoKey(create: boolean) {
    if (this.key) return this.key;
    const name = `fos-key-${this.uid}`;
    let raw = await this.keys.get(name);
    if (!raw) {
      if (!create) return null;
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      raw = b64(bytes);
      await this.keys.set(name, raw);
    }
    this.key = await crypto.subtle.importKey(
      'raw',
      unb64(raw),
      'AES-GCM',
      false,
      ['encrypt', 'decrypt'],
    );
    return this.key;
  }
  async put(name: string, value: unknown) {
    const key = (await this.cryptoKey(true))!;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(JSON.stringify(value)),
      ),
    );
    await this.kv.set(this.prefix + name, b64(iv) + '.' + chunkedB64(data));
  }
  async read<T>(name: string): Promise<T | null> {
    const raw = await this.kv.get(this.prefix + name);
    if (!raw) return null;
    const key = await this.cryptoKey(false);
    if (!key) return null; // key gone: ciphertext is unreadable by design
    try {
      const [iv, data] = raw.split('.');
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unb64(iv) },
        key,
        unb64(data),
      );
      return JSON.parse(dec.decode(plain)) as T;
    } catch {
      return null;
    }
  }
  async drop(name: string) {
    await this.kv.remove(this.prefix + name);
  }
  async names(scope = '') {
    return (await this.kv.keys())
      .filter((k) => k.startsWith(this.prefix + scope))
      .map((k) => k.slice(this.prefix.length));
  }
  /** Destroys every cached value for this user, then the key itself. */
  async destroy() {
    for (const k of await this.kv.keys())
      if (k.startsWith(this.prefix)) await this.kv.remove(k);
    await this.keys.remove(`fos-key-${this.uid}`);
    this.key = null;
  }
}
export function memoryKV(): KV & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
    keys: async () => [...m.keys()],
    dump: () => Object.fromEntries(m),
  };
}
export function memoryKeys(): KeyStore {
  const m = new Map<string, string>();
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
    remove: async (k) => void m.delete(k),
  };
}
