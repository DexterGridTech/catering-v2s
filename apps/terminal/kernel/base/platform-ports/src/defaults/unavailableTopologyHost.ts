import type {NoOutput, PortResult} from '../types/result';
import type {TopologyHostAddress, TopologyHostCall, TopologyHostConfig, TopologyHostDiagnostics, TopologyHostPort, TopologyHostStatus} from '../types/topologyHost';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailableTopologyHostPort: TopologyHostPort = {
  start: async (_input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>> => createUnavailable('topologyHost', 'start'),
  stop: async (_input: TopologyHostCall): Promise<PortResult<NoOutput>> => createUnavailable('topologyHost', 'stop'),
  getStatus: async (_input: TopologyHostCall): Promise<PortResult<TopologyHostStatus>> => createUnavailable('topologyHost', 'getStatus'),
  getDiagnosticsSnapshot: async (_input: TopologyHostCall): Promise<PortResult<TopologyHostDiagnostics>> => createUnavailable('topologyHost', 'getDiagnosticsSnapshot'),
};

if (__DEV__) {
  Object.defineProperty(unavailableTopologyHostPort, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'topologyHost',
      capabilities: Object.freeze([
        'start', 'stop', 'getStatus', 'getDiagnosticsSnapshot',
      ].map(capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}))),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
}
