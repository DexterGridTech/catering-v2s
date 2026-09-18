import rawTopologyTransportConfig from '../../topology-transport.config.json'
import type {TransportServerConfig} from '../types/transport'

export type TopologyTransportConfig = Readonly<{
  readonly port: number
  readonly basePath: string
  readonly statusPath: string
  readonly webSocketPath: string
  readonly heartbeatIntervalMs: number
  readonly heartbeatTimeoutMs: number
  readonly callTimeoutMs: number
  readonly reconnectBaseDelayMs: number
  readonly reconnectMaxDelayMs: number
}>

const basePath = rawTopologyTransportConfig.basePath.replace(/\/+$/, '')

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
})

export const topologyTransportServerConfig: TransportServerConfig = Object.freeze({
  selectedSpace: 'topology',
  spaces: Object.freeze([{
    name: 'topology',
    servers: Object.freeze([{
      serverName: 'topology',
      addresses: Object.freeze([{
        addressName: 'primary',
        baseUrl: `http://127.0.0.1:${topologyTransportConfig.port}${topologyTransportConfig.basePath}`,
        timeoutMs: topologyTransportConfig.callTimeoutMs,
      }]),
    }]),
  }]),
})
