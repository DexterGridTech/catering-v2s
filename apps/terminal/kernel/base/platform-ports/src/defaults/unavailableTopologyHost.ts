import type {NoOutput, PortResult} from '../types/result';
import type {TopologyHostAddress, TopologyHostCall, TopologyHostConfig, TopologyHostDiagnostics, TopologyHostPort, TopologyHostStatus} from '../types/topologyHost';
import {createUnavailable} from './createUnavailable';

export const unavailableTopologyHostPort: TopologyHostPort = {
  start: async (_input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>> => createUnavailable('topologyHost', 'start'),
  stop: async (_input: TopologyHostCall): Promise<PortResult<NoOutput>> => createUnavailable('topologyHost', 'stop'),
  getStatus: async (_input: TopologyHostCall): Promise<PortResult<TopologyHostStatus>> => createUnavailable('topologyHost', 'getStatus'),
  getDiagnosticsSnapshot: async (_input: TopologyHostCall): Promise<PortResult<TopologyHostDiagnostics>> => createUnavailable('topologyHost', 'getDiagnosticsSnapshot'),
};
