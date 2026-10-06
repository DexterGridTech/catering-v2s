import {describe, expect, it, vi} from 'vitest';
import type {Client, DeviceClient} from '@devicefarmer/adbkit';
import {requireReadyAndroidDevice} from '../src/androidAdb.js';

describe('requireReadyAndroidDevice', () => {
  it('selects the exact ready serial and returns its adbkit device client', async () => {
    const selectedDevice = {serial: 'emulator-5554'} as DeviceClient;
    const client = {
      listDevices: vi.fn().mockResolvedValue([
        {id: 'emulator-5554', type: 'device'},
        {id: 'emulator-5556', type: 'offline'},
      ]),
      getDevice: vi.fn().mockReturnValue(selectedDevice),
    } as unknown as Client;

    await expect(requireReadyAndroidDevice(client, 'emulator-5554')).resolves.toBe(selectedDevice);
    expect(client.getDevice).toHaveBeenCalledExactlyOnceWith('emulator-5554');
  });

  it('refuses a requested serial that is absent or not ready', async () => {
    const client = {
      listDevices: vi.fn().mockResolvedValue([{id: 'emulator-5556', type: 'offline'}]),
      getDevice: vi.fn(),
    } as unknown as Client;

    await expect(requireReadyAndroidDevice(client, 'emulator-5554')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_DEVICE_IDENTITY_UNAVAILABLE',
    );
    await expect(requireReadyAndroidDevice(client, 'emulator-5556')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_DEVICE_NOT_READY',
    );
    expect(client.getDevice).not.toHaveBeenCalled();
  });

  it('rejects unsafe serial strings before querying adbkit', async () => {
    const client = {listDevices: vi.fn(), getDevice: vi.fn()} as unknown as Client;
    await expect(requireReadyAndroidDevice(client, 'emulator;touch')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID',
    );
    expect(client.listDevices).not.toHaveBeenCalled();
  });
});
