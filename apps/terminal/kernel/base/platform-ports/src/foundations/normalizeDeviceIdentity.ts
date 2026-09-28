import type {DeviceIdentity, DeviceInfo} from '../types/device';
import type {PortResult} from '../types/result';

const unknownIdentity = (): DeviceIdentity =>
  Object.freeze({
    available: false,
    deviceId: null,
  });

export const normalizeDeviceIdentity = (result: PortResult<DeviceInfo>): DeviceIdentity => {
  if (result.status !== 'succeeded') return unknownIdentity();
  const deviceId = result.value.deviceId.trim();
  return deviceId.length === 0 ? unknownIdentity() : Object.freeze({available: true, deviceId});
};
