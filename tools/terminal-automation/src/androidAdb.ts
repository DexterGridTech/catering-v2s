import Adb, {type Client, type Device, type DeviceClient} from '@devicefarmer/adbkit';

export const createAndroidAdbClient = (
  input: Readonly<{readonly adbPath?: string; readonly timeoutMs?: number}> = {},
): Client =>
  Adb.createClient({
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
