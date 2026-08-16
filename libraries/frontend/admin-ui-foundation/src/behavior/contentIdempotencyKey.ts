function stableJson(value: unknown, inArray = false): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('IDEMPOTENCY_PAYLOAD_NOT_JSON');
    return JSON.stringify(value);
  }
  if (value === undefined) {
    if (inArray) return 'null';
    throw new Error('IDEMPOTENCY_PAYLOAD_NOT_JSON');
  }
  if (Array.isArray(value)) return `[${value.map(entry => stableJson(entry, true)).join(',')}]`;
  if (typeof value !== 'object') throw new Error('IDEMPOTENCY_PAYLOAD_NOT_JSON');
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new Error('IDEMPOTENCY_PAYLOAD_NOT_JSON');
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .filter(key => record[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`);
  return `{${entries.join(',')}}`;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function digestFileContent(file: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Creates a stable idempotency key for a set-value command. The payload must
 * be the JSON request projection; binary inputs must be represented by their
 * content digest rather than by a File or Blob object.
 */
export async function createContentIdempotencyKey(operationId: string, payload: unknown): Promise<string> {
  const canonical = `${operationId}\n${stableJson(payload)}`;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return `ui-content-${bytesToHex(new Uint8Array(digest))}`;
}
