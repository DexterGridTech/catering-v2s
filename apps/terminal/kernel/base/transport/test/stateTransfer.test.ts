import {Unzlib, zlibSync} from 'fflate';
import {describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseTopologyWireMessage, serializeTopologyWireMessage} from '@catering-v2s/kernel-base-contracts';
import {createTopologyStateReassembler, createTopologyStateTransferPlan, topologyChecksum} from '../src';

const randomText = (length: number, seed = 90210): string => {
  let value = seed >>> 0;
  let output = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let index = 0; index < length; index += 1) {
    value = Math.imul(value ^ (value >>> 13), 0x5bd1e995) >>> 0;
    value = (value + 0x6d2b79f5) >>> 0;
    output += alphabet[value & 63];
  }
  return output;
};

const transferInput = (value: unknown, forceCodec = false) => ({
  sliceName: 'kernel.feature.sample-member-registry.members' as const,
  direction: 'master-to-slave' as const,
  revision: 7,
  value: value as never,
  forceCodec,
  createWireId: (() => {
    let sequence = 0;
    return () => `wire-${++sequence}`;
  })(),
  createTransferId: () => 'transfer-test',
});

const readFixture = (fileName: string): {members: unknown} => {
  const fixturePath = resolve(process.cwd(), '../../../../../doc/plans/platform/fixtures', fileName);
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as {members: unknown};
};

describe('topology state transfer', () => {
  it('uses the closed raw fallback branches and forced codec with stable byte metadata', () => {
    const belowThreshold = createTopologyStateTransferPlan(
      transferInput(readFixture('ter-dual-machine-members-small-raw-fixture.json')),
    );
    expect(belowThreshold).toMatchObject({status: 'ready', codec: 'raw-base64', fallbackReason: 'below-threshold'});

    const lowCompressibility = createTopologyStateTransferPlan(
      transferInput(readFixture('ter-dual-machine-members-low-compressibility-fixture.json')),
    );
    expect(lowCompressibility).toMatchObject({
      status: 'ready',
      codec: 'raw-base64',
      fallbackReason: 'compression-not-beneficial',
    });

    const authoritative = readFixture('ter-dual-machine-members-capacity-fixture.json');
    const forced = createTopologyStateTransferPlan(transferInput(authoritative, true));
    expect(forced).toMatchObject({status: 'ready', codec: 'zlib-base64'});
    if (forced.status === 'ready') {
      const first = forced.frames[0];
      expect(first.rawBytes).toBeGreaterThan(0);
      expect(first.encodedBytes).toBeGreaterThan(0);
      expect(first.checksum).toBe(topologyChecksum(new TextEncoder().encode(JSON.stringify(authoritative))));
    }
  });

  it('streams zlib input in bounded pushes and rejects output beyond the declared prefix', () => {
    const value = {text: randomText(16_384)};
    const plan = createTopologyStateTransferPlan(transferInput(value, true));
    expect(plan).toMatchObject({status: 'ready', codec: 'zlib-base64'});
    if (plan.status !== 'ready') return;

    const push = vi.spyOn(Unzlib.prototype, 'push');
    try {
      const reassembler = createTopologyStateReassembler();
      const result = plan.frames
        .map(frame => reassembler.accept(parseTopologyWireMessage(serializeTopologyWireMessage(frame))))
        .at(-1);
      expect(result).toMatchObject({status: 'complete', message: {value}});
      expect(push.mock.calls.length).toBeGreaterThan(1);
      expect(push.mock.calls.every(([input]) => input.length <= 1024)).toBe(true);
      expect(push.mock.calls.reduce((sum, [input]) => sum + input.length, 0)).toBe(
        Buffer.from(plan.frames.map(frame => frame.payload).join(''), 'base64').length,
      );
    } finally {
      push.mockRestore();
    }

    const declaredPrefix = new TextEncoder().encode('{"ok":true}');
    const streamWithTrailingData = new Uint8Array(declaredPrefix.length + 8);
    streamWithTrailingData.set(declaredPrefix);
    streamWithTrailingData.fill(0x20, declaredPrefix.length);
    const compressed = zlibSync(streamWithTrailingData);
    const payload = Buffer.from(compressed).toString('base64');
    const overflow = createTopologyStateReassembler().accept({
      type: 'state-full-chunk',
      protocolVersion: 1,
      wireId: 'declared-prefix-overflow-wire',
      sliceName: 'kernel.feature.sample-member-registry.members',
      direction: 'master-to-slave',
      revision: 1,
      transferId: 'declared-prefix-overflow',
      index: 0,
      total: 1,
      codec: 'zlib-base64',
      rawBytes: declaredPrefix.length,
      encodedBytes: payload.length,
      checksum: topologyChecksum(declaredPrefix),
      payload,
    });
    expect(overflow).toMatchObject({status: 'failed', code: 'TOPOLOGY_REASSEMBLY_OVERFLOW'});

    const highlyCompressedOutput = new Uint8Array(4 * 1024 * 1024).fill(0x20);
    const highlyCompressedInput = zlibSync(highlyCompressedOutput);
    expect(highlyCompressedOutput.length / highlyCompressedInput.length).toBeGreaterThan(100);
    const highlyCompressedPayload = Buffer.from(highlyCompressedInput).toString('base64');
    const bombPush = vi.spyOn(Unzlib.prototype, 'push');
    try {
      const compressedOverflow = createTopologyStateReassembler().accept({
        type: 'state-full-chunk',
        protocolVersion: 1,
        wireId: 'compressed-expansion-overflow-wire',
        sliceName: 'kernel.feature.sample-member-registry.members',
        direction: 'master-to-slave',
        revision: 2,
        transferId: 'compressed-expansion-overflow',
        index: 0,
        total: 1,
        codec: 'zlib-base64',
        rawBytes: declaredPrefix.length,
        encodedBytes: highlyCompressedPayload.length,
        checksum: topologyChecksum(declaredPrefix),
        payload: highlyCompressedPayload,
      });
      expect(compressedOverflow).toMatchObject({status: 'failed', code: 'TOPOLOGY_REASSEMBLY_OVERFLOW'});
      expect(bombPush).toHaveBeenCalled();
      expect(bombPush.mock.calls.every(([input]) => input.length <= 1024)).toBe(true);
    } finally {
      bombPush.mockRestore();
    }
  });

  it('round trips a multi-chunk transfer with wire parsing, reordering and duplicate chunks', () => {
    const plan = createTopologyStateTransferPlan(
      transferInput(readFixture('ter-dual-machine-members-multi-chunk-stress-fixture.json')),
    );
    expect(plan.status).toBe('ready');
    if (plan.status !== 'ready') return;
    expect(plan.frames.length).toBe(8);
    const reassembler = createTopologyStateReassembler();
    const accepted: Array<ReturnType<typeof reassembler.accept>> = [];
    for (const frame of [...plan.frames].reverse()) {
      const parsed = parseTopologyWireMessage(serializeTopologyWireMessage(frame));
      if (parsed.type !== 'state-full-chunk') throw new Error('expected state-full-chunk');
      accepted.push(reassembler.accept(parsed));
    }
    const duplicate = reassembler.accept(plan.frames[0]!);
    expect(accepted.at(-1)).toMatchObject({status: 'complete', transferId: 'transfer-test'});
    expect(duplicate).toMatchObject({status: 'pending', transferId: 'transfer-test'});
    expect(accepted.at(-1)?.message?.value).toEqual(
      readFixture('ter-dual-machine-members-multi-chunk-stress-fixture.json'),
    );
  });

  it('round trips a members state above the command array bound while remaining byte-bounded', () => {
    const members = Array.from({length: 4_097}, (_, index) => ({
      memberId: `M${String(index).padStart(6, '0')}`,
      name: `会员${index}`,
      phone: `010${String(index).padStart(8, '0')}`,
      registeredAt: 1_700_000_000_000 + index * 86_400_000,
    }));
    const value = {
      mode: 'authoritative' as const,
      replaceMissing: true as const,
      entries: [
        {
          key: 'state',
          value: {
            updatedAt: 0,
            value: {members, pending: null},
          },
        },
      ],
    };
    const plan = createTopologyStateTransferPlan(transferInput(value));
    expect(plan.status).toBe('ready');
    if (plan.status !== 'ready') return;
    expect(plan.canonicalBytes).toBeLessThan(8 * 1024 * 1024);
    const reassembler = createTopologyStateReassembler();
    const accepted = plan.frames.map(frame =>
      reassembler.accept(parseTopologyWireMessage(serializeTopologyWireMessage(frame))),
    );
    expect(accepted.at(-1)).toMatchObject({status: 'complete'});
    expect(accepted.at(-1)?.message?.value).toEqual(value);
  });

  it('rejects an encoded payload above the reassembly bound before allocating frames', () => {
    const members = Array.from({length: 43_000}, (_, index) => ({
      memberId: `MOV${String(index).padStart(8, '0')}`,
      name: randomText(256, 90_210 + index),
      phone: `010${String(index).padStart(8, '0')}`,
      age: 20 + (index % 50),
      registeredAt: 1_700_000_000_000 + index * 86_400_000,
    }));
    const result = createTopologyStateTransferPlan(transferInput({members}));
    expect(result).toMatchObject({status: 'failed', code: 'TOPOLOGY_REASSEMBLY_OVERFLOW'});
    if (result.status === 'failed') {
      expect(result.encodedBytes).toBeGreaterThan(8 * 1024 * 1024);
      expect(result.canonicalBytes).toBeGreaterThan(result.encodedBytes ?? 0);
    }
  });

  it('rejects an oversized received transfer without applying a payload', () => {
    const reassembler = createTopologyStateReassembler();
    const result = reassembler.accept({
      type: 'state-full-chunk',
      protocolVersion: 1,
      wireId: 'received-overflow-wire',
      sliceName: 'kernel.feature.sample-member-registry.members',
      direction: 'master-to-slave',
      revision: 1,
      transferId: 'received-overflow-transfer',
      index: 0,
      total: 1,
      codec: 'raw-base64',
      rawBytes: 1,
      encodedBytes: 8 * 1024 * 1024 + 1,
      checksum: 'fnv1a32:00000000',
      payload: 'eA==',
    });
    expect(result).toMatchObject({status: 'failed', code: 'TOPOLOGY_REASSEMBLY_OVERFLOW'});
    expect(reassembler.size()).toBe(0);
  });

  it('rejects a changed duplicate chunk and expires an incomplete transfer', () => {
    const plan = createTopologyStateTransferPlan(transferInput({members: [{id: 'value', name: randomText(160_000)}]}));
    expect(plan.status).toBe('ready');
    if (plan.status !== 'ready') return;
    const first = plan.frames[0]!;
    let now = 1_000;
    const reassembler = createTopologyStateReassembler({now: () => now});
    const changed = {...first, payload: `${first.payload.slice(0, -1)}${first.payload.endsWith('A') ? 'B' : 'A'}`};
    expect(reassembler.accept(first)).toMatchObject({status: 'pending'});
    expect(reassembler.accept(changed)).toMatchObject({status: 'failed', code: 'TOPOLOGY_CHECKSUM_FAILED'});

    const secondPlan = createTopologyStateTransferPlan(
      transferInput({members: [{id: 'ttl', name: randomText(160_000)}]}),
    );
    expect(secondPlan.status).toBe('ready');
    if (secondPlan.status !== 'ready') return;
    const secondReassembler = createTopologyStateReassembler({now: () => now});
    expect(secondReassembler.accept(secondPlan.frames[0]!)).toMatchObject({status: 'pending'});
    now += 15_001;
    expect(secondReassembler.expire()).toMatchObject([
      {
        status: 'failed',
        transferId: 'transfer-test',
        code: 'TOPOLOGY_REASSEMBLY_TIMEOUT',
      },
    ]);
  });

  it('keeps incomplete transfers unapplied and bounds concurrent reassembly', () => {
    const plan = createTopologyStateTransferPlan(
      transferInput(readFixture('ter-dual-machine-members-multi-chunk-stress-fixture.json')),
    );
    expect(plan.status).toBe('ready');
    if (plan.status !== 'ready') return;
    const reassembler = createTopologyStateReassembler({maxInflightTransfers: 2});
    for (const frame of plan.frames.slice(0, -1)) {
      expect(reassembler.accept(frame)).toMatchObject({status: 'pending'});
    }
    expect(reassembler.size()).toBe(1);
    const second = {...plan.frames[0]!, transferId: 'transfer-second', wireId: 'wire-second'};
    const third = {...plan.frames[0]!, transferId: 'transfer-third', wireId: 'wire-third'};
    expect(reassembler.accept(second)).toMatchObject({status: 'pending'});
    expect(reassembler.accept(third)).toMatchObject({status: 'failed', code: 'TOPOLOGY_REASSEMBLY_OVERFLOW'});
    expect(reassembler.size()).toBe(2);
  });

  it('bounds completed transfer memory and remembers deterministic failures by transfer id', () => {
    const reassembler = createTopologyStateReassembler({completedTransferIdCapacity: 1});
    const first = createTopologyStateTransferPlan(transferInput({members: [{id: 'first'}]}));
    expect(first.status).toBe('ready');
    if (first.status !== 'ready') return;
    const second = createTopologyStateTransferPlan({
      ...transferInput({members: [{id: 'second'}]}),
      createTransferId: () => 'transfer-second',
    });
    expect(second.status).toBe('ready');
    if (second.status !== 'ready') return;
    expect(reassembler.accept(first.frames[0]!)).toMatchObject({status: 'complete'});
    expect(reassembler.accept(second.frames[0]!)).toMatchObject({status: 'complete'});
    // Capacity one evicts the first completion rather than retaining an
    // unbounded set of transfer ids forever.
    expect(reassembler.accept(first.frames[0]!)).toMatchObject({status: 'complete'});

    const oversized = reassembler.accept({
      ...first.frames[0]!,
      transferId: 'deterministic-failure',
      encodedBytes: 8 * 1024 * 1024 + 1,
    });
    expect(oversized).toMatchObject({status: 'failed', code: 'TOPOLOGY_REASSEMBLY_OVERFLOW'});
    expect(
      reassembler.accept({
        ...first.frames[0]!,
        transferId: 'deterministic-failure',
        encodedBytes: 8 * 1024 * 1024 + 1,
      }),
    ).toEqual(oversized);
  });
});
