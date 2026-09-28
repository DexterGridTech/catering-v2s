import rawTopologyTransportConfig from '../../topology-transport.config.json';
import type {TransportServerConfig} from '../types/transport';

export type TopologyTransportConfig = Readonly<{
  readonly port: number;
  readonly basePath: string;
  readonly statusPath: string;
  readonly webSocketPath: string;
  readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
  readonly callTimeoutMs: number;
  readonly reconnectBaseDelayMs: number;
  readonly reconnectMaxDelayMs: number;
  readonly compressionThresholdBytes: number;
  readonly compressionMinimumSavingsBytes: number;
  readonly compressionMinimumSavingsRatio: number;
  readonly chunkTargetBytes: number;
  readonly reassemblyMaxBytes: number;
  readonly reassemblyMaxInflightTransfers: number;
  readonly reassemblyTimeoutMs: number;
  readonly peerCommandMaxInflight: number;
  readonly cancelledCommandTtlMs: number;
}>;

const basePath = rawTopologyTransportConfig.basePath.replace(/\/+$/, '');

export const topologyTransportConfig: TopologyTransportConfig = Object.freeze({
  port: rawTopologyTransportConfig.port,
  basePath,
  statusPath: `${basePath}/status`,
  webSocketPath: `${basePath}/ws`,
  heartbeatIntervalMs: rawTopologyTransportConfig.heartbeatIntervalMs,
  heartbeatTimeoutMs: rawTopologyTransportConfig.heartbeatTimeoutMs,
  callTimeoutMs: rawTopologyTransportConfig.callTimeoutMs,
  reconnectBaseDelayMs: rawTopologyTransportConfig.reconnectBaseDelayMs,
  reconnectMaxDelayMs: rawTopologyTransportConfig.reconnectMaxDelayMs,
  compressionThresholdBytes: rawTopologyTransportConfig.compressionThresholdBytes,
  compressionMinimumSavingsBytes: rawTopologyTransportConfig.compressionMinimumSavingsBytes,
  compressionMinimumSavingsRatio: rawTopologyTransportConfig.compressionMinimumSavingsRatio,
  chunkTargetBytes: rawTopologyTransportConfig.chunkTargetBytes,
  reassemblyMaxBytes: rawTopologyTransportConfig.reassemblyMaxBytes,
  reassemblyMaxInflightTransfers: rawTopologyTransportConfig.reassemblyMaxInflightTransfers,
  reassemblyTimeoutMs: rawTopologyTransportConfig.reassemblyTimeoutMs,
  peerCommandMaxInflight: rawTopologyTransportConfig.peerCommandMaxInflight,
  cancelledCommandTtlMs: rawTopologyTransportConfig.callTimeoutMs,
});

export const topologyCompressionThresholdBytes = topologyTransportConfig.compressionThresholdBytes;
export const topologyCompressionMinimumSavingsBytes = topologyTransportConfig.compressionMinimumSavingsBytes;
export const topologyCompressionMinimumSavingsRatio = topologyTransportConfig.compressionMinimumSavingsRatio;
export const topologyChunkTargetBytes = topologyTransportConfig.chunkTargetBytes;
export const topologyReassemblyMaxBytes = topologyTransportConfig.reassemblyMaxBytes;
export const topologyReassemblyMaxInflightTransfers = topologyTransportConfig.reassemblyMaxInflightTransfers;
export const topologyReassemblyTimeoutMs = topologyTransportConfig.reassemblyTimeoutMs;
export const topologyPeerCommandMaxInflight = topologyTransportConfig.peerCommandMaxInflight;
export const topologyCancelledCommandTtlMs = topologyTransportConfig.cancelledCommandTtlMs;

export const topologyTransportServerConfig: TransportServerConfig = Object.freeze({
  selectedSpace: 'topology',
  spaces: Object.freeze([
    {
      name: 'topology',
      servers: Object.freeze([
        {
          serverName: 'topology',
          addresses: Object.freeze([
            {
              addressName: 'primary',
              baseUrl: `http://127.0.0.1:${topologyTransportConfig.port}${topologyTransportConfig.basePath}`,
              timeoutMs: topologyTransportConfig.callTimeoutMs,
            },
          ]),
        },
      ]),
    },
  ]),
});
