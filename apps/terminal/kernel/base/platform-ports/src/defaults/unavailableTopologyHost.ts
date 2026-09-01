import type {NoOutput, PortResult, PortUnavailable} from '../types/result';
import type {TopologyHostAddress, TopologyHostCall, TopologyHostConfig, TopologyHostDiagnostics, TopologyHostPort, TopologyHostStatus} from '../types/topologyHost';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'topologyHost',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `topologyHost.${capability}: adapter not injected`,
});

export const unavailableTopologyHostPort: TopologyHostPort = {
  start: async (_input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>> => unavailable('start'),
  stop: async (_input: TopologyHostCall): Promise<PortResult<NoOutput>> => unavailable('stop'),
  getStatus: async (_input: TopologyHostCall): Promise<PortResult<TopologyHostStatus>> => unavailable('getStatus'),
  getDiagnosticsSnapshot: async (_input: TopologyHostCall): Promise<PortResult<TopologyHostDiagnostics>> => unavailable('getDiagnosticsSnapshot'),
};
