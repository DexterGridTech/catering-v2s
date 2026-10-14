import {afterEach, describe, expect, it, vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import type {Client, DeviceClient} from '@devicefarmer/adbkit';
import {createAndroidAutomationConnection} from '../src/androidAutomationConnection.js';

const activeServers: Array<{readonly close: () => Promise<void>}> = [];

afterEach(async () => {
  for (const connection of activeServers.splice(0)) await connection.close();
});

const fakeAdb = (
  input: Readonly<{readonly initialReverse?: {remote: string; local: string}; readonly deviceId?: string}>,
) => {
  const reverses = input.initialReverse ? [input.initialReverse] : [];
  const device = {
    listReverses: vi.fn(async () => reverses.map(value => ({...value}))),
    reverse: vi.fn(async (remote: string, local: string) => {
      reverses.push({remote, local});
      return true;
    }),
  };
  const client = {
    listDevices: vi.fn(async () => [{id: input.deviceId ?? 'emulator-5554', type: 'emulator'}]),
    getDevice: vi.fn(() => device),
  };
  return {client: client as unknown as Client, device: device as unknown as DeviceClient, reverses};
};

describe('createAndroidAutomationConnection', () => {
  it('binds one ephemeral listener to the selected device reverse and closes both owned resources', async () => {
    const adb = fakeAdb({});
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === '--remove') adb.reverses.splice(0);
    });
    const connection = await createAndroidAutomationConnection({
      client: adb.client,
      serial: 'emulator-5554',
      repositoryRoot: process.cwd(),
      adbPath: '/usr/bin/adb',
      shape: 'dual',
      token: 'managed-driver-token',
      runCommand,
    });
    activeServers.push(connection);

    expect(connection.hostPort).toBeGreaterThan(0);
    expect(adb.device.reverse).toHaveBeenCalledExactlyOnceWith('tcp:19090', 'tcp:' + connection.hostPort);
    expect(connection.driver.server.address()).toMatchObject({port: connection.hostPort});

    await connection.close();
    expect(runCommand).toHaveBeenCalledExactlyOnceWith('/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'reverse',
      '--remove',
      'tcp:19090',
    ]);
    expect(connection.driver.server.address()).toBeNull();
  });

  it('journals the exact run-owned driver reverse attachment and release', async () => {
    const runId = randomUUID();
    const runDirectory = path.join(process.cwd(), '.runtime/terminal-automation', runId);
    mkdirSync(runDirectory, {recursive: true});
    writeFileSync(path.join(runDirectory, 'events.jsonl'), '');
    const oldRunId = process.env.TERMINAL_AUTOMATION_RUN_ID;
    const oldRunDirectory = process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY;
    process.env.TERMINAL_AUTOMATION_RUN_ID = runId;
    process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY = runDirectory;
    try {
      const adb = fakeAdb({});
      const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
        if (args[3] === '--remove') {
          const index = adb.reverses.findIndex(value => value.remote === args[4]);
          if (index >= 0) adb.reverses.splice(index, 1);
        }
      });
      const tdsServicePorts = Array.from({length: 10}, (_, index) => ({
        remotePort: 28_180 + index,
        localPort: 18_180 + index,
      }));
      const connection = await createAndroidAutomationConnection({
        client: adb.client,
        serial: 'emulator-5554',
        repositoryRoot: process.cwd(),
        adbPath: '/usr/bin/adb',
        shape: 'mobile',
        token: 'managed-driver-token',
        managedServicePorts: [
          {remotePort: 28080, localPort: 18080},
          ...tdsServicePorts,
        ],
        runCommand,
      });
      await connection.close();
      const events = readFileSync(path.join(runDirectory, 'events.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line));
      expect(events.map(event => `${event.event}:${event.remote}`)).toEqual([
        'android.reverse.driver.attached:tcp:19090',
        'android.reverse.managed.attached:tcp:28080',
        ...tdsServicePorts.map(value => `android.reverse.managed.attached:tcp:${value.remotePort}`),
        ...[...tdsServicePorts].reverse().map(value => `android.reverse.managed.released:tcp:${value.remotePort}`),
        'android.reverse.managed.released:tcp:28080',
        'android.reverse.driver.released:tcp:19090',
      ]);
      for (const event of events) {
        expect(event).toMatchObject({runId, deviceSerial: 'emulator-5554'});
        expect(event.local).toMatch(/^tcp:[1-9][0-9]{0,4}$/u);
      }
    } finally {
      if (oldRunId === undefined) delete process.env.TERMINAL_AUTOMATION_RUN_ID;
      else process.env.TERMINAL_AUTOMATION_RUN_ID = oldRunId;
      if (oldRunDirectory === undefined) delete process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY;
      else process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY = oldRunDirectory;
      rmSync(runDirectory, {recursive: true, force: true});
    }
  });

  it('owns only the CBS reverse on the paired slave and releases it with the driver reverse', async () => {
    const adb = fakeAdb({deviceId: 'emulator-5556'});
    const commands: string[][] = [];
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      commands.push([...args]);
      if (args[3] === '--remove') {
        const index = adb.reverses.findIndex(value => value.remote === args[4]);
        if (index >= 0) adb.reverses.splice(index, 1);
      }
    });
    const connection = await createAndroidAutomationConnection({
      client: adb.client,
      serial: 'emulator-5556',
      repositoryRoot: process.cwd(),
      adbPath: '/usr/bin/adb',
      shape: 'mobile',
      token: 'managed-driver-token',
      managedServicePorts: [{remotePort: 28_080, localPort: 18_080}],
      runCommand,
    });
    activeServers.push(connection);

    expect(connection.servicePorts).toEqual([{remotePort: 28_080, localPort: 18_080}]);
    expect(adb.reverses).toContainEqual({remote: 'tcp:28080', local: 'tcp:18080'});
    expect(adb.reverses.some(value => value.remote === 'tcp:28180' || value.remote === 'tcp:28181')).toBe(false);
    await connection.close();
    expect(adb.reverses).toEqual([]);
    expect(commands).toContainEqual(['-s', 'emulator-5556', 'reverse', '--remove', 'tcp:28080']);
    expect(commands).toContainEqual(['-s', 'emulator-5556', 'reverse', '--remove', 'tcp:19090']);
  });

  it('journals topology host forward ownership and exact release for the selected MASTER device', async () => {
    const runId = randomUUID();
    const runDirectory = path.join(process.cwd(), '.runtime/terminal-automation', runId);
    mkdirSync(runDirectory, {recursive: true});
    writeFileSync(path.join(runDirectory, 'events.jsonl'), '');
    const oldRunId = process.env.TERMINAL_AUTOMATION_RUN_ID;
    const oldRunDirectory = process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY;
    process.env.TERMINAL_AUTOMATION_RUN_ID = runId;
    process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY = runDirectory;
    try {
      const adb = fakeAdb({});
      let forwards = '';
      const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
        if (args.includes('--no-rebind')) forwards = 'emulator-5554 tcp:43172 tcp:43172\n';
        if (args.includes('forward') && args.includes('--remove')) forwards = '';
        if (args[3] === '--remove' && args[2] === 'reverse') adb.reverses.splice(0);
      });
      const connection = await createAndroidAutomationConnection({
        client: adb.client,
        serial: 'emulator-5554',
        repositoryRoot: process.cwd(),
        adbPath: '/usr/bin/adb',
        shape: 'mobile',
        token: 'managed-driver-token',
        runCommand,
        runTextCommand: async (_adbPath, args) => {
          if (args.join(' ') === 'forward --list') return forwards;
          throw new Error('UNEXPECTED_ADB_READ');
        },
      });
      await connection.attachTopologyHostForward(43172);
      await connection.close();
      const events = readFileSync(path.join(runDirectory, 'events.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line));
      expect(events.filter(event => event.event.startsWith('android.forward.topology-host.'))).toEqual([
        expect.objectContaining({
          event: 'android.forward.topology-host.attached',
          runId,
          deviceSerial: 'emulator-5554',
          local: 'tcp:43172',
          remote: 'tcp:43172',
        }),
        expect.objectContaining({
          event: 'android.forward.topology-host.released',
          runId,
          deviceSerial: 'emulator-5554',
          local: 'tcp:43172',
          remote: 'tcp:43172',
        }),
      ]);
      expect(forwards).toBe('');
    } finally {
      if (oldRunId === undefined) delete process.env.TERMINAL_AUTOMATION_RUN_ID;
      else process.env.TERMINAL_AUTOMATION_RUN_ID = oldRunId;
      if (oldRunDirectory === undefined) delete process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY;
      else process.env.TERMINAL_AUTOMATION_RUN_DIRECTORY = oldRunDirectory;
      rmSync(runDirectory, {recursive: true, force: true});
    }
  });

  it('exposes the fixture API created for the same authenticated driver session', async () => {
    const adb = fakeAdb({});
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === '--remove') adb.reverses.splice(0);
    });
    let fixtureServer: unknown;
    const connection = await createAndroidAutomationConnection({
      client: adb.client,
      serial: 'emulator-5554',
      repositoryRoot: process.cwd(),
      adbPath: '/usr/bin/adb',
      shape: 'mobile',
      token: 'managed-driver-token',
      runCommand,
      fixtureFactory: server => {
        fixtureServer = server;
        return Object.freeze({
          ensureActivated: async ({deviceId}: {shape: 'mobile' | 'dual'; deviceId: string; runId: string}) =>
            Object.freeze({
              seedKey: 'term-handheld' as const,
              terminalRef: 'terminal-ref',
              storeRef: 'store-ref',
              deviceId,
              bindingGeneration: 1,
            }),
        });
      },
    });
    activeServers.push(connection);

    expect(connection.fixtures).toBeDefined();
    expect(fixtureServer).toBe(connection.driver);
    await expect(
      connection.fixtures?.ensureActivated({shape: 'mobile', deviceId: 'device', runId: 'run'}),
    ).resolves.toMatchObject({seedKey: 'term-handheld', deviceId: 'device', bindingGeneration: 1});
  });

  it('fails closed on an occupied device endpoint and closes the ephemeral listener', async () => {
    const adb = fakeAdb({initialReverse: {remote: 'tcp:19090', local: 'tcp:19999'}});
    await expect(
      createAndroidAutomationConnection({
        client: adb.client,
        serial: 'emulator-5554',
        repositoryRoot: process.cwd(),
        adbPath: '/usr/bin/adb',
        shape: 'dual',
        token: 'managed-driver-token',
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_REVERSE_ALREADY_OWNED');
    expect(adb.device.reverse).not.toHaveBeenCalled();
  });
});
