import {mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Client, DeviceClient} from '@devicefarmer/adbkit';
import {createAndroidDeviceSession, managedDevServiceReverses} from '../src/androidDevice.js';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, {recursive: true, force: true});
});

const createClient = (input: Readonly<{readonly deviceId?: string; readonly reverseList?: {remote: string; local: string}[]}>) => {
  const reverses = [...(input.reverseList ?? [])];
  const device = {
    listReverses: vi.fn(async () => reverses.map(reverse => ({...reverse}))),
    reverse: vi.fn(async (remote: string, local: string) => {
      reverses.push({remote, local});
      return true;
    }),
    install: vi.fn(async () => true),
    startActivity: vi.fn(async () => true),
  };
  const client = {
    listDevices: vi.fn(async () => [{id: input.deviceId ?? 'emulator-5554', type: 'emulator'}]),
    getDevice: vi.fn(() => device),
  };
  return {client: client as unknown as Client, device: device as unknown as DeviceClient, reverses};
};

const repository = (): Readonly<{readonly root: string; readonly apk: string}> => {
  const root = mkdtempSync(path.join(tmpdir(), 'terminal-automation-android-'));
  roots.push(root);
  const apk = path.join(root, 'build/app.apk');
  mkdirSync(path.dirname(apk), {recursive: true});
  writeFileSync(apk, 'fixture-apk');
  return {root, apk};
};

describe('createAndroidDeviceSession', () => {
  it('maps only the three managed loopback DEV services to matching Android reverse ports', () => {
    expect(
      managedDevServiceReverses({
        businessBaseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
        tdsEntryOneUrl: 'ws://127.0.0.1:28180',
        tdsEntryTwoUrl: 'ws://127.0.0.1:28181',
      }),
    ).toEqual([
      {remotePort: 28_080, localPort: 28_080},
      {remotePort: 28_180, localPort: 28_180},
      {remotePort: 28_181, localPort: 28_181},
    ]);
    expect(() =>
      managedDevServiceReverses({
        businessBaseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
        tdsEntryOneUrl: 'ws://127.0.0.1:28180',
        tdsEntryTwoUrl: 'ws://127.0.0.1:28080',
      }),
    ).toThrow('TERMINAL_AUTOMATION_MANAGED_DEV_URL_INVALID');
  });

  it('binds install, launch, and reverse operations to the selected ready serial', async () => {
    const repo = repository();
    const context = createClient({});
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === '--remove') context.reverses.splice(0);
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
      runCommand,
    });

    await session.install(repo.apk);
    await session.launch('com.example.terminal/com.example.terminal.MainActivity');
    const release = await session.attachDriver(19_123);
    expect(context.device.reverse).toHaveBeenCalledExactlyOnceWith('tcp:19090', 'tcp:19123');
    expect(context.device.install).toHaveBeenCalledExactlyOnceWith(realpathSync(repo.apk));
    expect(context.device.startActivity).toHaveBeenCalledExactlyOnceWith({
      component: 'com.example.terminal/com.example.terminal.MainActivity',
      wait: true,
    });

    await release();
    await release();
    expect(runCommand).toHaveBeenCalledExactlyOnceWith('/usr/bin/adb', [
      '-s',
      'emulator-5554',
      'reverse',
      '--remove',
      'tcp:19090',
    ]);
    expect(context.reverses).toEqual([]);
  });

  it('binds the three managed DEV endpoints to loopback and releases only its exact reverse mappings', async () => {
    const context = createClient({});
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[3] === '--remove') {
        const remote = args[4];
        const index = context.reverses.findIndex(value => value.remote === remote);
        if (index >= 0) context.reverses.splice(index, 1);
      }
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });
    const release = await session.attachManagedServicePorts([
      {remotePort: 28_080, localPort: 28_080},
      {remotePort: 28_180, localPort: 28_180},
      {remotePort: 28_181, localPort: 28_181},
    ]);
    expect(context.reverses).toEqual([
      {remote: 'tcp:28080', local: 'tcp:28080'},
      {remote: 'tcp:28180', local: 'tcp:28180'},
      {remote: 'tcp:28181', local: 'tcp:28181'},
    ]);
    await release();
    expect(context.reverses).toEqual([]);
    expect(runCommand).toHaveBeenCalledTimes(3);
  });

  it('rejects an existing service reverse without overwriting it', async () => {
    const context = createClient({reverseList: [{remote: 'tcp:28080', local: 'tcp:29000'}]});
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
    });
    await expect(
      session.attachManagedServicePorts([
        {remotePort: 28_080, localPort: 28_080},
        {remotePort: 28_180, localPort: 28_180},
        {remotePort: 28_181, localPort: 28_181},
      ]),
    ).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_MANAGED_REVERSE_ALREADY_OWNED');
    expect(context.device.reverse).not.toHaveBeenCalled();
    expect(context.reverses).toEqual([{remote: 'tcp:28080', local: 'tcp:29000'}]);
  });

  it('does not replace an existing reverse or remove a mapping whose owner changed', async () => {
    const occupied = createClient({reverseList: [{remote: 'tcp:19090', local: 'tcp:19999'}]});
    const occupiedSession = await createAndroidDeviceSession({
      client: occupied.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
    });
    await expect(occupiedSession.attachDriver(19_123)).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_REVERSE_ALREADY_OWNED',
    );
    expect(occupied.device.reverse).not.toHaveBeenCalled();

    const context = createClient({});
    const runCommand = vi.fn(async () => undefined);
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });

    const release = await session.attachDriver(19_123);
    context.reverses[0].local = 'tcp:19999';
    await expect(release()).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_REVERSE_OWNERSHIP_CHANGED');
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('reports cleanup failure after reverse creation when readback cannot establish ownership', async () => {
    const context = createClient({deviceId: 'emulator-owned-7'});
    const runCommand = vi.fn(async () => undefined);
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-owned-7',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });
    vi.spyOn(context.device, 'listReverses')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{remote: 'tcp:19090', local: 'tcp:19999'}])
      .mockResolvedValueOnce([{remote: 'tcp:19090', local: 'tcp:19999'}]);

    await expect(session.attachDriver(19_123)).rejects.toThrow(
      'TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:ANDROID_REVERSE_ACQUISITION',
    );
    expect(context.device.reverse).toHaveBeenCalledExactlyOnceWith('tcp:19090', 'tcp:19123');
    expect(runCommand).not.toHaveBeenCalled();
    expect(context.reverses).toEqual([{remote: 'tcp:19090', local: 'tcp:19123'}]);
  });

  it('surfaces failed cleanup of only the managed reverse created before setup failed', async () => {
    const context = createClient({deviceId: 'emulator-owned-9'});
    vi.spyOn(context.device, 'reverse').mockImplementationOnce(async (remote, local) => {
      context.reverses.push({remote, local});
      return true;
    }).mockRejectedValueOnce(new Error('injected second reverse failure'));
    const runCommand = vi.fn(async () => { throw new Error('injected reverse remove failure'); });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-owned-9',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
    });

    await expect(session.attachManagedServicePorts([
      {remotePort: 28_080, localPort: 28_080},
      {remotePort: 28_180, localPort: 28_180},
      {remotePort: 28_181, localPort: 28_181},
    ])).rejects.toThrow('TERMINAL_AUTOMATION_DEVICE_CLEANUP_FAILED:ANDROID_MANAGED_REVERSE_ACQUISITION');
    expect(runCommand).toHaveBeenCalledExactlyOnceWith('/usr/bin/adb', [
      '-s', 'emulator-owned-9', 'reverse', '--remove', 'tcp:28080',
    ]);
    expect(context.reverses).toEqual([{remote: 'tcp:28080', local: 'tcp:28080'}]);
  });

  it('rejects an APK path outside the repository and invalid activity component', async () => {
    const repo = repository();
    const context = createClient({});
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: repo.root,
      adbPath: '/usr/bin/adb',
    });

    await expect(session.install(path.join(tmpdir(), 'outside.apk'))).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_APK_INVALID',
    );
    await expect(session.launch('com.example.terminal;id/com.example.MainActivity')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_COMPONENT_INVALID',
    );
    expect(context.device.install).not.toHaveBeenCalled();
    expect(context.device.startActivity).not.toHaveBeenCalled();
  });

  it('only uninstalls the explicit package after readback proves it is present', async () => {
    const context = createClient({});
    let installed = true;
    const runTextCommand = vi.fn(async (_adbPath: string, args: readonly string[]) =>
      args.includes('list') && installed ? 'package:com.anonymous.sampleterminal.terauto1234abcd\n' : '',
    );
    const runCommand = vi.fn(async (_adbPath: string, args: readonly string[]) => {
      if (args[2] === 'uninstall') installed = false;
    });
    const session = await createAndroidDeviceSession({
      client: context.client,
      serial: 'emulator-5554',
      repositoryRoot: tmpdir(),
      adbPath: '/usr/bin/adb',
      runCommand,
      runTextCommand,
    });
    const packageName = 'com.anonymous.sampleterminal.terauto1234abcd';
    expect(await session.isInstalled(packageName)).toBe(true);
    await session.uninstall(packageName);
    expect(runCommand).toHaveBeenCalledExactlyOnceWith(
      '/usr/bin/adb',
      ['-s', 'emulator-5554', 'uninstall', packageName],
      'TERMINAL_AUTOMATION_ANDROID_UNINSTALL_FAILED',
    );
    expect(await session.isInstalled(packageName)).toBe(false);
    await expect(session.uninstall('com.example.foreign')).resolves.toBeUndefined();
  });
});
