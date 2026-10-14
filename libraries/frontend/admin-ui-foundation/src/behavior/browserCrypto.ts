import {sha256} from '@noble/hashes/sha2.js';

export type BrowserCryptoSource = Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>>;

export async function digestSha256Bytes(
  value: Uint8Array,
  subtle: Pick<SubtleCrypto, 'digest'> | null = globalThis.crypto?.subtle ?? null,
): Promise<Uint8Array> {
  const bytes = Uint8Array.from(value);
  if (subtle) return new Uint8Array(await subtle.digest('SHA-256', bytes));
  return sha256(bytes);
}

export function createBrowserUuid(cryptoApi: BrowserCryptoSource | undefined = globalThis.crypto): string {
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (!cryptoApi?.getRandomValues) throw new Error('WEB_CRYPTO_RANDOM_UNAVAILABLE');

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
