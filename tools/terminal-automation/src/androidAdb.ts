import {createRequire} from 'node:module';
import Adb, {type Client, type Device, type DeviceClient} from '@devicefarmer/adbkit';

const adbkit = createRequire(import.meta.url)('@devicefarmer/adbkit') as Readonly<{
  readonly Adb: typeof Adb;
}>;

export type AndroidDeviceIdentity = Readonly<{
  readonly kind: 'physical' | 'emulator' | 'unknown';
  readonly model: string;
  readonly product: string;
  readonly device: string;
  readonly hardware: string;
  readonly qemu: '0' | '1' | 'unknown';
}>;

export const createAndroidAdbClient = (
  input: Readonly<{readonly adbPath?: string; readonly timeoutMs?: number}> = {},
): Client =>
  adbkit.Adb.createClient({
    ...(input.adbPath === undefined ? {} : {bin: input.adbPath}),
    ...(input.timeoutMs === undefined ? {} : {timeout: input.timeoutMs}),
  });

export const requireReadyAndroidDevice = async (client: Client, serial: string): Promise<DeviceClient> => {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(serial)) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_SERIAL_INVALID');
  }
  let devices: Device[];
  try {
    devices = await client.listDevices();
  } catch {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_DISCOVERY_FAILED');
  }
  const matching = devices.filter(device => device.id === serial);
  if (matching.length !== 1) throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_IDENTITY_UNAVAILABLE');
  if (matching[0].type !== 'device' && matching[0].type !== 'emulator') {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_NOT_READY');
  }
  return client.getDevice(serial);
};

const safeProperty = (value: unknown): string =>
  typeof value === 'string' && value.trim()
    ? value.trim().replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, 80)
    : 'UNKNOWN';

export const classifyAndroidDeviceProperties = (
  properties: Readonly<Record<string, unknown>>,
): AndroidDeviceIdentity => {
  const model = safeProperty(properties['ro.product.model']);
  const product = safeProperty(properties['ro.product.name']);
  const device = safeProperty(properties['ro.product.device']);
  const hardware = safeProperty(properties['ro.hardware']);
  const rawQemu = properties['ro.kernel.qemu'];
  const qemu = rawQemu === '0' || rawQemu === '1' ? rawQemu : 'unknown';
  const emulatorMarker = /(?:^|[^a-z])(?:emulator|goldfish|ranchu|cuttlefish|sdk_gphone|generic)(?:[^a-z]|$)/iu;
  const hardwareFacts = `${model} ${product} ${device} ${hardware}`;
  const hasEmulatorMarker = emulatorMarker.test(hardwareFacts);
  const hasCompleteProductIdentity = model !== 'UNKNOWN' && product !== 'UNKNOWN' && device !== 'UNKNOWN';
  const hasCompleteHardwareIdentity = hasCompleteProductIdentity && hardware !== 'UNKNOWN';
  const kind = qemu === '1' || hasEmulatorMarker
    ? 'emulator'
    : (qemu === '0' && hasCompleteProductIdentity) || hasCompleteHardwareIdentity
      ? 'physical'
      : 'unknown';

  return Object.freeze({kind, model, product, device, hardware, qemu});
};

export const inspectAndroidDeviceIdentity = async (
  client: Client,
  serial: string,
): Promise<AndroidDeviceIdentity> => {
  const device = await requireReadyAndroidDevice(client, serial);
  try {
    return classifyAndroidDeviceProperties(await device.getProperties());
  } catch {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_DEVICE_PROPERTIES_UNAVAILABLE');
  }
};
