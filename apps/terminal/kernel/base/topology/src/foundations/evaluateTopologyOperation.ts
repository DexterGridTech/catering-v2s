import {topologyTransportConfig} from '@catering-v2s/kernel-base-contracts'
import type {
  TopologyFailureReasonCode,
  TopologyDisplayRole,
  TopologyOperation,
  TopologyOperationEligibility,
  TopologyInstanceMode,
  SurfaceForm,
} from '@catering-v2s/kernel-base-contracts'

export type TopologyEligibilityInput = Readonly<{
  readonly operation: TopologyOperation
  readonly surfaceForm: SurfaceForm | undefined
  readonly displayCount: number | null
  readonly instanceMode: TopologyInstanceMode
  readonly displayRole: TopologyDisplayRole
  readonly paired: boolean
  readonly peerReachable: boolean
}>

const denied = (
  operation: TopologyOperation,
  reasonCode: Exclude<TopologyFailureReasonCode, 'allowed'>,
): TopologyOperationEligibility => Object.freeze({operation, allowed: false, reasonCode})

export const evaluateTopologyOperation = (
  input: TopologyEligibilityInput,
): TopologyOperationEligibility => {
  if (input.surfaceForm !== 'laptop') return denied(input.operation, 'TOPOLOGY_UNSUPPORTED_FORM')
  if (input.displayCount !== 1) return denied(input.operation, 'TOPOLOGY_REQUIRES_SINGLE_SCREEN')
  if (input.operation === 'unpair') {
    return input.paired
      ? Object.freeze({operation: input.operation, allowed: true, reasonCode: 'allowed' as const})
      : denied(input.operation, 'TOPOLOGY_NOT_PAIRED')
  }
  if (input.operation === 'pair' || input.operation === 'query-host') {
    if (input.instanceMode !== 'MASTER') return denied(input.operation, 'TOPOLOGY_REQUIRES_MASTER')
    if (input.paired) return denied(input.operation, 'TOPOLOGY_ALREADY_PAIRED')
  }
  if (input.operation === 'enable-host' && input.instanceMode !== 'MASTER') {
    return denied(input.operation, 'TOPOLOGY_REQUIRES_MASTER')
  }
  // Reachability is deliberately not an eligibility gate.  It only describes
  // whether a currently allowed peer operation can be delivered; it must not
  // change the paired/secondary semantics while reconnecting.
  return Object.freeze({operation: input.operation, allowed: true, reasonCode: 'allowed' as const})
}

export const hasTopologySecondarySurface = (input: Readonly<{
  readonly displayCount: number | null
  readonly instanceMode: TopologyInstanceMode
  readonly paired: boolean
}>): boolean => input.displayCount !== null
  && input.displayCount >= 2
  || (input.instanceMode === 'MASTER' && input.paired)

export const topologyReasonMessages: Readonly<Record<TopologyFailureReasonCode, string>> = Object.freeze({
  allowed: '',
  TOPOLOGY_UNSUPPORTED_FORM: 'mobile 形态不支持双机拓扑',
  TOPOLOGY_REQUIRES_SINGLE_SCREEN: '双机拓扑要求本机只有一个物理屏',
  TOPOLOGY_REQUIRES_MASTER: '当前节点不是主机',
  TOPOLOGY_ALREADY_PAIRED: '当前主机已有副机',
  TOPOLOGY_NOT_PAIRED: '尚未配对副机',
  TOPOLOGY_PEER_UNREACHABLE: '已配对，副机暂时不可达，系统将持续重连',
  TOPOLOGY_IDENTITY_FAILED: '无法读取对端身份，请检查地址后重试',
  TOPOLOGY_HOST_FAILED: '服务未能按当前设置启动',
  TOPOLOGY_HOST_PORT_OCCUPIED: `服务端口 ${topologyTransportConfig.port} 被占用，请关闭占用该端口的应用后重试`,
  TOPOLOGY_STALE_LOCATOR: '旧配对记录已清理',
  TOPOLOGY_INVALID_LOCATOR: '配对地址无效，请重新查询后重试',
  TOPOLOGY_ROLE_OCCUPIED: '对端已有配对设备',
  TOPOLOGY_PROTOCOL_REJECTED: '对端拒绝了拓扑连接',
  TOPOLOGY_TIMEOUT: '拓扑操作超时，请重试',
  TOPOLOGY_UNAVAILABLE: '拓扑能力当前不可用',
  TOPOLOGY_CODEC_FAILED: '拓扑状态编码失败，请稍后重试',
  TOPOLOGY_CHECKSUM_FAILED: '拓扑状态完整性校验失败，正在等待下一次同步',
  TOPOLOGY_DECODED_PAYLOAD_INVALID: '拓扑状态内容无效，正在等待下一次同步',
  TOPOLOGY_REASSEMBLY_OVERFLOW: '拓扑状态超过安全传输上限，正在等待下一次同步',
  TOPOLOGY_REASSEMBLY_TIMEOUT: '拓扑状态分片接收超时，正在等待下一次同步',
})
