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

const fakeAdb = (input: Readonly<{readonly initialReverse?: {remote: string; local: string}}>) => {
  const reverses = input.initialReverse ? [input.initialReverse] : [];
  const device = {
    listReverses: vi.fn(async () => reverses.map(value => ({...value}))),
    reverse: vi.fn(async (remote: string, local: string) => {
      reverses.push({remote, local});
      return true;
    }),
  };
  const client = {
    listDevices: vi.fn(async () => [{id: 'emulator-5554', type: 'emulator'}]),
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
      const connection = await createAndroidAutomationConnection({
        client: adb.client,
        serial: 'emulator-5554',
        repositoryRoot: process.cwd(),
        adbPath: '/usr/bin/adb',
        shape: 'mobile',
        token: 'managed-driver-token',
        managedServicePorts: [
          {remotePort: 28080, localPort: 18080},
          {remotePort: 28180, localPort: 18180},
          {remotePort: 28181, localPort: 18181},
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
        'android.reverse.managed.attached:tcp:28180',
        'android.reverse.managed.attached:tcp:28181',
        'android.reverse.managed.released:tcp:28181',
        'android.reverse.managed.released:tcp:28180',
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
