import type {PortFailure, PortResult, PortUnavailable, NoOutput} from '../types/result';
import type {DeviceCall, DevicePort, DeviceInfo, PowerStatus, PowerStatusSubscriptionInput, PowerStatusUnsubscribeInput, SystemStatus} from '../types/device';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'device',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `device.${capability}: adapter not injected`,
});

export const unavailableDevicePort: DevicePort = {
  getDeviceInfo: async (_input: DeviceCall): Promise<PortResult<DeviceInfo>> => unavailable('getDeviceInfo'),
  getSystemStatus: async (_input: DeviceCall): Promise<PortResult<SystemStatus>> => unavailable('getSystemStatus'),
  getPowerStatus: async (_input: DeviceCall): Promise<PortResult<PowerStatus>> => unavailable('getPowerStatus'),
  subscribePowerStatus: async (_input: PowerStatusSubscriptionInput): Promise<PortResult<{readonly subscriptionId: string}>> => unavailable('subscribePowerStatus'),
  unsubscribePowerStatus: async (_input: PowerStatusUnsubscribeInput): Promise<PortResult<NoOutput>> => unavailable('unsubscribePowerStatus'),
};
