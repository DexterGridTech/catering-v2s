import type {PortResult, NoOutput} from '../types/result';
import type {DeviceCall, DevicePort, DeviceInfo, DisplayInfo, PowerStatus, PowerStatusSubscriptionInput, PowerStatusUnsubscribeInput, SystemStatus} from '../types/device';
import {createUnavailable} from './createUnavailable';

export const unavailableDevicePort: DevicePort = {
  getDeviceInfo: async (_input: DeviceCall): Promise<PortResult<DeviceInfo>> => createUnavailable('device', 'getDeviceInfo'),
  getDisplayInfo: async (_input: DeviceCall): Promise<PortResult<DisplayInfo>> => createUnavailable('device', 'getDisplayInfo'),
  getSystemStatus: async (_input: DeviceCall): Promise<PortResult<SystemStatus>> => createUnavailable('device', 'getSystemStatus'),
  getPowerStatus: async (_input: DeviceCall): Promise<PortResult<PowerStatus>> => createUnavailable('device', 'getPowerStatus'),
  subscribePowerStatus: async (_input: PowerStatusSubscriptionInput): Promise<PortResult<{readonly subscriptionId: string}>> => createUnavailable('device', 'subscribePowerStatus'),
  unsubscribePowerStatus: async (_input: PowerStatusUnsubscribeInput): Promise<PortResult<NoOutput>> => createUnavailable('device', 'unsubscribePowerStatus'),
};
