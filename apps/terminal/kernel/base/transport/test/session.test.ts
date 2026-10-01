import {describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseTopologyWireMessage, serializeTopologyWireMessage} from '@catering-v2s/kernel-base-contracts';
import {createTopologyStateTransferPlan} from '../src/foundations/createTopologyStateTransfer';
import {createTopologySession} from '../src/foundations/createTopologySession';

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

const readMultiChunkFixture = (): unknown =>
  JSON.parse(
    readFileSync(
      resolve(
        process.cwd(),
        '../../../../../doc/plans/platform/fixtures/ter-dual-machine-members-multi-chunk-stress-fixture.json',
      ),
      'utf8',
    ),
  );

describe('topology transport session', () => {
  it('serializes outgoing frames and reports parsed incoming frames', () => {
    const write = vi.fn();
    const onMessage = vi.fn();
    const session = createTopologySession({
      write,
      onMessage,
      onProtocolError: vi.fn(),
      closeTransport: vi.fn(),
    });
    session.markConnecting();
    session.markOpen();
    expect(session.state()).toBe('open');
    const frame = {type: 'ping' as const, protocolVersion: 1 as const, wireId: 'p1', sequence: 1};
    session.send(frame);
    expect(write).toHaveBeenCalledOnce();
    session.receive(write.mock.calls[0]?.[0] as string);
    expect(onMessage).toHaveBeenCalledWith(frame);
    session.close('test-done');
  });

  it('keeps control frames ahead of queued state chunks', async () => {
    const writes: Array<{readonly raw: string; readonly resolve?: () => void}> = [];
    const write = vi.fn((raw: string) => {
      if (writes.length < 2) {
        return new Promise<void>(resolve => {
          writes.push({raw, resolve});
        });
      }
      writes.push({raw});
      return Promise.resolve();
    });
    const session = createTopologySession({
      write,
      onMessage: vi.fn(),
      onProtocolError: vi.fn(),
      closeTransport: vi.fn(),
    });
    session.markOpen();
    const transfer = session.sendStateFull({
      sliceName: 'kernel.feature.sample-member-registry.members',
      direction: 'master-to-slave',
      revision: 1,
      value: {members: [{memberId: 'M1', name: randomText(420_000)}]},
      createTransferId: () => 'session-transfer',
      createWireId: (() => {
        let sequence = 0;
        return () => `session-wire-${++sequence}`;
      })(),
    });
    await Promise.resolve();
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0]!.raw)).toMatchObject({type: 'state-full-chunk'});

    session.send({type: 'ping', protocolVersion: 1, wireId: 'priority-ping', sequence: 1});
    writes[0]!.resolve?.();
    await Promise.resolve();
    expect(writes[1]).toBeDefined();
    expect(JSON.parse(writes[1]!.raw)).toMatchObject({type: 'ping', wireId: 'priority-ping'});
    writes[1]!.resolve?.();
    await expect(transfer).resolves.toMatchObject({status: 'ready'});
    session.close('test-done');
  });

  it('reports client heartbeat timeout without converting it to a payload failure', async () => {
    let clock = 0;
    let tick: (() => void) | undefined;
    const timeouts: number[] = [];
    const writes: string[] = [];
    const session = createTopologySession({
      write: async raw => {
        writes.push(raw);
      },
      onMessage: vi.fn(),
      onProtocolError: vi.fn(),
      onPeerTimeout: () => {
        timeouts.push(1);
      },
      closeTransport: vi.fn(),
      isClient: true,
      heartbeat: {
        intervalMs: 10,
        timeoutMs: 30,
        now: () => clock,
        schedule: (_intervalMs, callback) => {
          tick = callback;
          return () => {
            tick = undefined;
          };
        },
      },
    });
    session.markOpen();
    tick?.();
    await Promise.resolve();
    expect(JSON.parse(writes[0] ?? '{}')).toMatchObject({type: 'ping'});
    session.receive(JSON.stringify({type: 'pong', protocolVersion: 1, wireId: 'pong-1', sequence: 1}));
    clock = 31;
    tick?.();
    expect(timeouts).toEqual([1]);
    session.close('test-done');
  });

  it('does not write a frame when sender-side payload encoding fails', async () => {
    const write = vi.fn();
    const session = createTopologySession({
      write,
      onMessage: vi.fn(),
      onProtocolError: vi.fn(),
      closeTransport: vi.fn(),
      reassembly: {schedule: () => () => {}},
    });
    session.markOpen();
    await expect(
      session.sendStateFull({
        sliceName: 'kernel.feature.sample-member-registry.members',
        direction: 'master-to-slave',
        revision: 1,
        value: {invalidJsonValue: 1n} as never,
      }),
    ).resolves.toMatchObject({status: 'failed', code: 'TOPOLOGY_CODEC_FAILED'});
    expect(write).not.toHaveBeenCalled();
    session.close('test-done');
  });

  it('does not apply a partial transfer and applies the complete transfer through the session message boundary', () => {
    const onMessage = vi.fn();
    const session = createTopologySession({
      write: vi.fn(),
      onMessage,
      onProtocolError: vi.fn(),
      closeTransport: vi.fn(),
      reassembly: {schedule: () => () => {}},
    });
    session.markOpen();
    const plan = createTopologyStateTransferPlan({
      sliceName: 'kernel.feature.sample-member-registry.members',
      direction: 'master-to-slave',
      revision: 11,
      value: readMultiChunkFixture() as never,
      createTransferId: () => 'session-multi-transfer',
      createWireId: (() => {
        let sequence = 0;
        return () => `session-multi-wire-${++sequence}`;
      })(),
    });
    expect(plan.status).toBe('ready');
    if (plan.status !== 'ready') return;
    expect(plan.frames.length).toBeGreaterThan(1);
    for (const frame of plan.frames.slice(0, -1)) {
      session.receive(serializeTopologyWireMessage(frame));
    }
    expect(onMessage).not.toHaveBeenCalled();
    const final = parseTopologyWireMessage(serializeTopologyWireMessage(plan.frames.at(-1)!));
    session.receive(serializeTopologyWireMessage(final));
    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage.mock.calls[0]?.[0]).toMatchObject({
      type: 'state-full',
      revision: 11,
      value: readMultiChunkFixture(),
    });
    session.close('test-done');
  });

  it('keeps control heartbeat traffic ahead of delayed multi-chunk data writes', async () => {
    let clock = 0;
    let tick: (() => void) | undefined;
    let releaseFirstDataWrite: (() => void) | undefined;
    const startedTypes: string[] = [];
    const timeouts: number[] = [];
    const write = vi.fn((raw: string) => {
      const type = JSON.parse(raw).type as string;
      startedTypes.push(type);
      if (type === 'state-full-chunk' && releaseFirstDataWrite === undefined) {
        return new Promise<void>(resolve => {
          releaseFirstDataWrite = resolve;
        });
      }
      return Promise.resolve();
    });
    const session = createTopologySession({
      write,
      onMessage: vi.fn(),
      onProtocolError: vi.fn(),
      onPeerTimeout: () => {
        timeouts.push(1);
      },
      closeTransport: vi.fn(),
      isClient: true,
      heartbeat: {
        intervalMs: 10,
        timeoutMs: 30,
        now: () => clock,
        schedule: (_intervalMs, callback) => {
          tick = callback;
          return () => {
            tick = undefined;
          };
        },
      },
      reassembly: {schedule: () => () => {}},
    });
    session.markOpen();
    const transfer = session.sendStateFull({
      sliceName: 'kernel.feature.sample-member-registry.members',
      direction: 'master-to-slave',
      revision: 12,
      value: readMultiChunkFixture() as never,
      createTransferId: () => 'heartbeat-multi-transfer',
      createWireId: (() => {
        let sequence = 0;
        return () => `heartbeat-multi-wire-${++sequence}`;
      })(),
    });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(startedTypes[0]).toBe('state-full-chunk');
    clock = 10;
    tick?.();
    releaseFirstDataWrite?.();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(startedTypes).toContain('ping');
    session.receive(JSON.stringify({type: 'pong', protocolVersion: 1, wireId: 'heartbeat-pong', sequence: 1}));
    clock = 39;
    tick?.();
    expect(timeouts).toEqual([]);
    await expect(transfer).resolves.toMatchObject({status: 'ready'});
    expect(startedTypes[1]).toBe('ping');
    session.close('test-done');
  });

  it('does not carry a partial transfer across a new session generation', () => {
    const onMessage = vi.fn();
    const createReceiver = () => {
      const receiver = createTopologySession({
        write: vi.fn(),
        onMessage,
        onProtocolError: vi.fn(),
        closeTransport: vi.fn(),
        reassembly: {schedule: () => () => {}},
      });
      receiver.markOpen();
      return receiver;
    };
    const plan = createTopologyStateTransferPlan({
      sliceName: 'kernel.feature.sample-member-registry.members',
      direction: 'master-to-slave',
      revision: 13,
      value: readMultiChunkFixture() as never,
      createTransferId: () => 'generation-transfer',
    });
    expect(plan.status).toBe('ready');
    if (plan.status !== 'ready') return;
    const firstSession = createReceiver();
    for (const frame of plan.frames.slice(0, -1)) firstSession.receive(JSON.stringify(frame));
    expect(onMessage).not.toHaveBeenCalled();
    firstSession.close('generation-change');

    const secondSession = createReceiver();
    secondSession.receive(JSON.stringify(plan.frames.at(-1)));
    expect(onMessage).not.toHaveBeenCalled();
    secondSession.close('test-done');
  });
});
