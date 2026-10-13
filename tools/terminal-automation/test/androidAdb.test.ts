import {describe, expect, it, vi} from 'vitest';
import type {Client, DeviceClient} from '@devicefarmer/adbkit';
import {
  classifyAndroidDeviceProperties,
  createAndroidAdbClient,
  inspectAndroidDeviceIdentity,
  requireReadyAndroidDevice,
} from '../src/androidAdb.js';

describe('createAndroidAdbClient', () => {
  it('uses the resolved CommonJS Adb export under the native Node ESM runtime', () => {
    const client = createAndroidAdbClient({timeoutMs: 1_000});
    expect(client.listDevices).toBeTypeOf('function');
    expect(client.getDevice).toBeTypeOf('function');
  });
});

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

describe('Android device kind', () => {
  it('classifies a physical device only with qemu=0 and concrete product identity', () => {
    expect(classifyAndroidDeviceProperties({
      'ro.kernel.qemu': '0',
      'ro.product.model': 'Z3',
      'ro.product.name': 'D3',
      'ro.product.device': 'D3',
      'ro.hardware': 'mt6895',
    })).toEqual({kind: 'physical', model: 'Z3', product: 'D3', device: 'D3', hardware: 'mt6895', qemu: '0'});
  });

  it('classifies qemu and emulator product markers as emulator', () => {
    expect(classifyAndroidDeviceProperties({'ro.kernel.qemu': '1'}).kind).toBe('emulator');
    expect(classifyAndroidDeviceProperties({
      'ro.kernel.qemu': 'unknown',
      'ro.product.model': 'sdk_gphone64_x86_64',
      'ro.product.name': 'sdk_gphone64_x86_64',
      'ro.product.device': 'emu64x',
      'ro.hardware': 'ranchu',
    }).kind).toBe('emulator');
  });

  it('classifies a device with complete non-emulator hardware identity when qemu is absent', () => {
    expect(classifyAndroidDeviceProperties({
      'ro.product.model': 'Z3',
      'ro.product.name': 'D3',
      'ro.product.device': 'D3',
      'ro.hardware': 'rk30board',
    })).toEqual({kind: 'physical', model: 'Z3', product: 'D3', device: 'D3', hardware: 'rk30board', qemu: 'unknown'});
  });

  it('keeps incomplete identity unknown instead of assuming a physical device', () => {
    expect(classifyAndroidDeviceProperties({'ro.kernel.qemu': '0'}).kind).toBe('unknown');
    expect(classifyAndroidDeviceProperties({
      'ro.kernel.qemu': 'unknown',
      'ro.product.model': 'Z3',
      'ro.product.name': 'D3',
      'ro.product.device': 'D3',
    }).kind).toBe('unknown');
  });

  it('reads properties from the exact ready serial through adbkit', async () => {
    const selectedDevice = {
      getProperties: vi.fn().mockResolvedValue({
        'ro.kernel.qemu': '0',
        'ro.product.model': 'Z3',
        'ro.product.name': 'D3',
        'ro.product.device': 'D3',
      }),
    } as unknown as DeviceClient;
    const client = {
      listDevices: vi.fn().mockResolvedValue([{id: 'D409P5C2J0285', type: 'device'}]),
      getDevice: vi.fn().mockReturnValue(selectedDevice),
    } as unknown as Client;

    await expect(inspectAndroidDeviceIdentity(client, 'D409P5C2J0285')).resolves.toMatchObject({
      kind: 'physical', model: 'Z3', product: 'D3', device: 'D3', qemu: '0',
    });
    expect(client.getDevice).toHaveBeenCalledExactlyOnceWith('D409P5C2J0285');
    expect(selectedDevice.getProperties).toHaveBeenCalledExactlyOnceWith();
  });

  it('fails closed when the selected pair peer properties cannot be read', async () => {
    const selectedDevice = {getProperties: vi.fn().mockRejectedValue(new Error('private transport detail'))} as unknown as DeviceClient;
    const client = {
      listDevices: vi.fn().mockResolvedValue([{id: 'emulator-peer', type: 'emulator'}]),
      getDevice: vi.fn().mockReturnValue(selectedDevice),
    } as unknown as Client;

    await expect(inspectAndroidDeviceIdentity(client, 'emulator-peer')).rejects.toThrow(
      'TERMINAL_AUTOMATION_ANDROID_DEVICE_PROPERTIES_UNAVAILABLE',
    );
    expect(client.getDevice).toHaveBeenCalledExactlyOnceWith('emulator-peer');
  });
});
