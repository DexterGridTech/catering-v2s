import {
  createEnvelopeId,
  isTopologyJsonValue,
  topologyTransportConfig,
  type TopologyJsonValue,
  type TopologyStateFullMessage,
  type TopologyWireErrorCode,
  type TopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts';
import {strFromU8, strToU8, Unzlib, zlibSync} from 'fflate';

export type TopologyStateTransferFallbackReason = 'below-threshold' | 'compression-not-beneficial';

export type TopologyStateTransferPlan = Readonly<{
  readonly status: 'ready';
  readonly frames: readonly Extract<TopologyWireMessage, {readonly type: 'state-full-chunk'}>[];
  readonly canonicalBytes: number;
  readonly encodedBytes: number;
  readonly codec: 'zlib-base64' | 'raw-base64';
  readonly fallbackReason?: TopologyStateTransferFallbackReason;
}>;

export type TopologyStateTransferFailure = Readonly<{
  readonly status: 'failed';
  readonly code: Extract<
    TopologyWireErrorCode,
    | 'TOPOLOGY_CODEC_FAILED'
    | 'TOPOLOGY_REASSEMBLY_OVERFLOW'
    | 'TOPOLOGY_PROTOCOL_REJECTED'
    | 'TOPOLOGY_PEER_UNREACHABLE'
  >;
  readonly retryable: boolean;
  readonly deterministic: boolean;
  readonly encodedBytes?: number;
  readonly canonicalBytes?: number;
}>;

export type TopologyStateTransferResult = TopologyStateTransferPlan | TopologyStateTransferFailure;

export type CreateTopologyStateTransferInput = Readonly<{
  readonly sliceName: string;
  readonly direction: TopologyStateFullMessage['direction'];
  readonly revision: number;
  readonly value: TopologyJsonValue;
  readonly forceCodec?: boolean;
  readonly createWireId?: () => string;
  readonly createTransferId?: () => string;
}>;

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const bytesToBase64 = (bytes: Uint8Array): string => {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += base64Alphabet[first >> 2];
    output += base64Alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    output += second === undefined ? '=' : base64Alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    output += third === undefined ? '=' : base64Alphabet[third & 63];
  }
  return output;
};

const base64ToBytes = (value: string): Uint8Array => {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('invalid topology base64 payload');
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = base64Alphabet.indexOf(value[index] ?? '');
    const second = base64Alphabet.indexOf(value[index + 1] ?? '');
    const third = value[index + 2] === '=' ? 0 : base64Alphabet.indexOf(value[index + 2] ?? '');
    const fourth = value[index + 3] === '=' ? 0 : base64Alphabet.indexOf(value[index + 3] ?? '');
    if (first < 0 || second < 0 || third < 0 || fourth < 0) throw new Error('invalid topology base64 payload');
    const combined = (first << 18) | (second << 12) | (third << 6) | fourth;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (combined >> 16) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = (combined >> 8) & 0xff;
    if (outputIndex < bytes.length) bytes[outputIndex++] = combined & 0xff;
  }
  return bytes;
};

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const zlibInputChunkBytes = 1024;
const zlibOutputOverflow = Symbol('topology-zlib-output-overflow');

/**
 * fflate 0.8.3 processes a complete push before invoking ondata. Keep each
 * compressed input push bounded at 1,024 bytes. The design's conservative
 * DEFLATE expansion bound is four 258-byte matches per compressed input byte;
 * the output callback rejects any cumulative output beyond rawBytes.
 */
const inflateBase64Parts = (parts: readonly string[], rawBytes: number, maxBytes: number): Uint8Array => {
  if (!Number.isSafeInteger(rawBytes) || rawBytes <= 0 || rawBytes > maxBytes) {
    throw new Error('invalid topology raw byte limit');
  }
  const output = new Uint8Array(rawBytes);
  let outputOffset = 0;
  let encodedOffset = 0;
  const inflater = new Unzlib(decoded => {
    if (outputOffset + decoded.length > rawBytes) throw zlibOutputOverflow;
    output.set(decoded, outputOffset);
    outputOffset += decoded.length;
  });

  for (const [partIndex, part] of parts.entries()) {
    const decoded = base64ToBytes(part);
    encodedOffset += decoded.length;
    if (encodedOffset > maxBytes) throw new Error('topology compressed input exceeds limit');
    for (let offset = 0; offset < decoded.length; offset += zlibInputChunkBytes) {
      const end = Math.min(offset + zlibInputChunkBytes, decoded.length);
      const final = partIndex === parts.length - 1 && end === decoded.length;
      inflater.push(decoded.subarray(offset, end), final);
    }
  }
  if (encodedOffset === 0) throw new Error('empty topology compressed input');
  if (outputOffset !== rawBytes) throw new Error('topology decompressed byte count mismatch');
  return output;
};

export const topologyChecksum = (bytes: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const failure = (
  code: TopologyStateTransferFailure['code'],
  canonicalBytes?: number,
  encodedBytes?: number,
): TopologyStateTransferFailure =>
  Object.freeze({
    status: 'failed',
    code,
    retryable: false,
    deterministic: true,
    ...(canonicalBytes === undefined ? {} : {canonicalBytes}),
    ...(encodedBytes === undefined ? {} : {encodedBytes}),
  });

export const createTopologyStateTransferPlan = (
  input: CreateTopologyStateTransferInput,
): TopologyStateTransferResult => {
  let canonicalText: string;
  try {
    canonicalText = JSON.stringify(input.value);
  } catch {
    return failure('TOPOLOGY_CODEC_FAILED');
  }
  const canonical = strToU8(canonicalText);
  const rawBase64 = bytesToBase64(canonical);
  let encodedBase64 = rawBase64;
  let codec: 'zlib-base64' | 'raw-base64' = 'raw-base64';
  let fallbackReason: TopologyStateTransferFallbackReason | undefined;
  if (input.forceCodec || canonical.length >= topologyTransportConfig.compressionThresholdBytes) {
    try {
      const compressedBase64 = bytesToBase64(zlibSync(canonical, {level: 6}));
      const savingsBytes = rawBase64.length - compressedBase64.length;
      const savingsRatio = rawBase64.length === 0 ? 0 : savingsBytes / rawBase64.length;
      if (
        input.forceCodec ||
        (savingsBytes >= topologyTransportConfig.compressionMinimumSavingsBytes &&
          savingsRatio >= topologyTransportConfig.compressionMinimumSavingsRatio)
      ) {
        encodedBase64 = compressedBase64;
        codec = 'zlib-base64';
      } else {
        fallbackReason = 'compression-not-beneficial';
      }
    } catch {
      return failure('TOPOLOGY_CODEC_FAILED', canonical.length);
    }
  } else {
    fallbackReason = 'below-threshold';
  }

  if (encodedBase64.length > topologyTransportConfig.reassemblyMaxBytes) {
    return failure('TOPOLOGY_REASSEMBLY_OVERFLOW', canonical.length, encodedBase64.length);
  }

  const chunkTarget = Math.max(4, Math.floor(topologyTransportConfig.chunkTargetBytes / 4) * 4);
  const total = Math.max(1, Math.ceil(encodedBase64.length / chunkTarget));
  const transferId = input.createTransferId?.() ?? String(createEnvelopeId());
  const checksum = topologyChecksum(canonical);
  const frames: Extract<TopologyWireMessage, {readonly type: 'state-full-chunk'}>[] = [];
  for (let index = 0; index < total; index += 1) {
    const payload = encodedBase64.slice(index * chunkTarget, (index + 1) * chunkTarget);
    const frame = Object.freeze({
      type: 'state-full-chunk' as const,
      protocolVersion: 1 as const,
      wireId: input.createWireId?.() ?? String(createEnvelopeId()),
      sliceName: input.sliceName,
      direction: input.direction,
      revision: input.revision,
      transferId,
      index,
      total,
      codec,
      rawBytes: canonical.length,
      encodedBytes: encodedBase64.length,
      checksum,
      payload,
    });
    frames.push(frame);
  }
  return Object.freeze({
    status: 'ready',
    frames: Object.freeze(frames),
    canonicalBytes: canonical.length,
    encodedBytes: encodedBase64.length,
    codec,
    ...(fallbackReason === undefined ? {} : {fallbackReason}),
  });
};

export type TopologyReassemblyResult = Readonly<{
  readonly status: 'pending' | 'complete' | 'failed';
  readonly message?: TopologyStateFullMessage;
  readonly code?: Extract<
    TopologyWireErrorCode,
    | 'TOPOLOGY_CODEC_FAILED'
    | 'TOPOLOGY_CHECKSUM_FAILED'
    | 'TOPOLOGY_DECODED_PAYLOAD_INVALID'
    | 'TOPOLOGY_REASSEMBLY_OVERFLOW'
    | 'TOPOLOGY_REASSEMBLY_TIMEOUT'
    | 'TOPOLOGY_PROTOCOL_REJECTED'
  >;
  readonly transferId: string;
  readonly sliceName?: Extract<TopologyWireMessage, {readonly type: 'state-full-chunk'}>['sliceName'];
  readonly revision?: number;
}>;

type ReassemblyEntry = {
  readonly firstSeenAt: number;
  readonly chunks: Map<number, string>;
  readonly metadata: Extract<TopologyWireMessage, {readonly type: 'state-full-chunk'}>;
};

export type TopologyStateReassembler = Readonly<{
  readonly accept: (
    chunk: Extract<TopologyWireMessage, {readonly type: 'state-full-chunk'}>,
  ) => TopologyReassemblyResult;
  readonly expire: () => readonly TopologyReassemblyResult[];
  readonly clear: () => void;
  readonly size: () => number;
}>;

export const createTopologyStateReassembler = (
  options: Readonly<{
    readonly now?: () => number;
    readonly maxBytes?: number;
    readonly maxInflightTransfers?: number;
    readonly timeoutMs?: number;
    readonly completedTransferIdCapacity?: number;
  }> = {},
): TopologyStateReassembler => {
  const now = options.now ?? (() => Date.now());
  const maxBytes = options.maxBytes ?? topologyTransportConfig.reassemblyMaxBytes;
  const maxInflightTransfers = options.maxInflightTransfers ?? topologyTransportConfig.reassemblyMaxInflightTransfers;
  const timeoutMs = options.timeoutMs ?? topologyTransportConfig.reassemblyTimeoutMs;
  const completedTransferIdCapacity = Math.max(1, options.completedTransferIdCapacity ?? 256);
  const entries = new Map<string, ReassemblyEntry>();
  const completed = new Map<string, number>();
  const failed = new Map<string, TopologyReassemblyResult>();

  const remember = <T>(store: Map<string, T>, transferId: string, value: T): void => {
    store.delete(transferId);
    store.set(transferId, value);
    while (store.size > completedTransferIdCapacity) {
      const oldest = store.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  };

  const deterministicCodes = new Set<NonNullable<TopologyReassemblyResult['code']>>([
    'TOPOLOGY_CODEC_FAILED',
    'TOPOLOGY_CHECKSUM_FAILED',
    'TOPOLOGY_DECODED_PAYLOAD_INVALID',
    'TOPOLOGY_REASSEMBLY_OVERFLOW',
    'TOPOLOGY_PROTOCOL_REJECTED',
  ]);

  const fail = (
    transferId: string,
    code: TopologyReassemblyResult['code'],
    chunk?: Extract<TopologyWireMessage, {readonly type: 'state-full-chunk'}>,
  ): TopologyReassemblyResult => {
    const result = Object.freeze({
      status: 'failed' as const,
      transferId,
      code,
      ...(chunk === undefined ? {} : {sliceName: chunk.sliceName, revision: chunk.revision}),
    });
    if (code !== undefined && deterministicCodes.has(code)) remember(failed, transferId, result);
    return result;
  };

  const accept = (
    chunk: Extract<TopologyWireMessage, {readonly type: 'state-full-chunk'}>,
  ): TopologyReassemblyResult => {
    const previousFailure = failed.get(chunk.transferId);
    if (previousFailure !== undefined) return previousFailure;
    if (completed.has(chunk.transferId)) return Object.freeze({status: 'pending', transferId: chunk.transferId});
    if (chunk.encodedBytes > maxBytes || chunk.rawBytes > maxBytes) {
      entries.delete(chunk.transferId);
      return fail(chunk.transferId, 'TOPOLOGY_REASSEMBLY_OVERFLOW', chunk);
    }
    let entry = entries.get(chunk.transferId);
    if (entry === undefined) {
      if (entries.size >= maxInflightTransfers) return fail(chunk.transferId, 'TOPOLOGY_REASSEMBLY_OVERFLOW', chunk);
      entry = {firstSeenAt: now(), chunks: new Map(), metadata: chunk};
      entries.set(chunk.transferId, entry);
    } else if (
      entry.metadata.total !== chunk.total ||
      entry.metadata.sliceName !== chunk.sliceName ||
      entry.metadata.direction !== chunk.direction ||
      entry.metadata.revision !== chunk.revision ||
      entry.metadata.codec !== chunk.codec ||
      entry.metadata.rawBytes !== chunk.rawBytes ||
      entry.metadata.encodedBytes !== chunk.encodedBytes ||
      entry.metadata.checksum !== chunk.checksum
    ) {
      entries.delete(chunk.transferId);
      return fail(chunk.transferId, 'TOPOLOGY_PROTOCOL_REJECTED', chunk);
    }
    const previous = entry.chunks.get(chunk.index);
    if (previous !== undefined && previous !== chunk.payload) {
      entries.delete(chunk.transferId);
      return fail(chunk.transferId, 'TOPOLOGY_CHECKSUM_FAILED', chunk);
    }
    entry.chunks.set(chunk.index, chunk.payload);
    if (entry.chunks.size < chunk.total) return Object.freeze({status: 'pending', transferId: chunk.transferId});

    try {
      const encodedPayloadLength = Array.from(entry.chunks.values()).reduce((sum, part) => sum + part.length, 0);
      if (encodedPayloadLength !== chunk.encodedBytes) {
        entries.delete(chunk.transferId);
        return fail(chunk.transferId, 'TOPOLOGY_REASSEMBLY_OVERFLOW', chunk);
      }
      const encodedParts = Array.from({length: chunk.total}, (_, index) => entry?.chunks.get(index) ?? '');
      let canonical: Uint8Array;
      if (chunk.codec === 'zlib-base64') {
        canonical = inflateBase64Parts(encodedParts, chunk.rawBytes, maxBytes);
      } else {
        const encoded = encodedParts.map(base64ToBytes);
        const encodedLength = encoded.reduce((sum, part) => sum + part.length, 0);
        if (encodedLength === 0 || encodedLength > maxBytes) {
          entries.delete(chunk.transferId);
          return fail(chunk.transferId, 'TOPOLOGY_REASSEMBLY_OVERFLOW', chunk);
        }
        canonical = concatBytes(encoded);
      }
      if (canonical.length !== chunk.rawBytes || topologyChecksum(canonical) !== chunk.checksum) {
        entries.delete(chunk.transferId);
        return fail(chunk.transferId, 'TOPOLOGY_CHECKSUM_FAILED', chunk);
      }
      const value: unknown = JSON.parse(strFromU8(canonical));
      if (!isTopologyJsonValue(value)) throw new Error('decoded payload is not JSON');
      const message: TopologyStateFullMessage = Object.freeze({
        type: 'state-full',
        protocolVersion: 1,
        wireId: `state-${chunk.transferId}`,
        sliceName: chunk.sliceName,
        direction: chunk.direction,
        revision: chunk.revision,
        value,
      });
      entries.delete(chunk.transferId);
      remember(completed, chunk.transferId, now());
      return Object.freeze({status: 'complete', transferId: chunk.transferId, message});
    } catch (error) {
      entries.delete(chunk.transferId);
      const code =
        error === zlibOutputOverflow
          ? 'TOPOLOGY_REASSEMBLY_OVERFLOW'
          : error instanceof SyntaxError
            ? 'TOPOLOGY_DECODED_PAYLOAD_INVALID'
            : 'TOPOLOGY_CODEC_FAILED';
      return fail(chunk.transferId, code, chunk);
    }
  };

  return Object.freeze({
    accept,
    expire: (): readonly TopologyReassemblyResult[] => {
      const expired: TopologyReassemblyResult[] = [];
      const cutoff = now() - timeoutMs;
      for (const [transferId, entry] of entries) {
        if (entry.firstSeenAt <= cutoff) {
          entries.delete(transferId);
          expired.push(fail(transferId, 'TOPOLOGY_REASSEMBLY_TIMEOUT', entry.metadata));
        }
      }
      return Object.freeze(expired);
    },
    clear: (): void => {
      entries.clear();
      completed.clear();
      failed.clear();
    },
    size: (): number => entries.size,
  });
};
