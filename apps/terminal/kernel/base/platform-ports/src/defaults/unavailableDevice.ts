import type {PortResult, NoOutput} from '../types/result';
import type {DeviceCall, DevicePort, DeviceInfo, DisplayInfo, PowerStatus, PowerStatusSubscriptionInput, PowerStatusUnsubscribeInput, SystemStatus} from '../types/device';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableDevicePort: DevicePort = {
  getDeviceInfo: async (_input: DeviceCall): Promise<PortResult<DeviceInfo>> => createUnavailable('device', 'getDeviceInfo'),
  getDisplayInfo: async (_input: DeviceCall): Promise<PortResult<DisplayInfo>> => createUnavailable('device', 'getDisplayInfo'),
  getSystemStatus: async (_input: DeviceCall): Promise<PortResult<SystemStatus>> => createUnavailable('device', 'getSystemStatus'),
  getPowerStatus: async (_input: DeviceCall): Promise<PortResult<PowerStatus>> => createUnavailable('device', 'getPowerStatus'),
  subscribePowerStatus: async (_input: PowerStatusSubscriptionInput): Promise<PortResult<{readonly subscriptionId: string}>> => createUnavailable('device', 'subscribePowerStatus'),
  unsubscribePowerStatus: async (_input: PowerStatusUnsubscribeInput): Promise<PortResult<NoOutput>> => createUnavailable('device', 'unsubscribePowerStatus'),
};

Object.defineProperty(unavailableDevicePort, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'device',
      capabilities: Object.freeze([
        'getDeviceInfo', 'getDisplayInfo', 'getSystemStatus', 'getPowerStatus',
        'subscribePowerStatus', 'unsubscribePowerStatus',
      ].map(capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}))),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
});
