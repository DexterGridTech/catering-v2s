import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import type {
  TopologyAdminCapability,
  TopologyAdminCommandResult,
  TopologyFailureReasonCode,
  TopologyIdentity,
  TopologyOperation,
  TopologyOperationEligibility,
  TopologyPageAvailability,
} from '@catering-v2s/kernel-base-contracts'
import type {CommandDispatchResult, Runtime} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {resolveSurfaceDisplayMode, resolveWorkspace} from '@catering-v2s/kernel-base-display-context'
import {evaluateTopologyOperation} from './evaluateTopologyOperation'
import {selectTopologyFacts} from '../selectors/selectTopologyFacts'
import {
  pairByHostTopologyCommand,
  setTopologyHostEnabledCommand,
  unpairTopologyCommand,
} from '../features/commands/commands'

export type TopologyAdminRuntime = Pick<Runtime, 'getState' | 'dispatchCommand'>

const reasonCodes = new Set<TopologyFailureReasonCode>([
  'allowed',
  'TOPOLOGY_UNSUPPORTED_FORM',
  'TOPOLOGY_REQUIRES_SINGLE_SCREEN',
  'TOPOLOGY_REQUIRES_MASTER',
  'TOPOLOGY_ALREADY_PAIRED',
  'TOPOLOGY_NOT_PAIRED',
  'TOPOLOGY_PEER_UNREACHABLE',
  'TOPOLOGY_IDENTITY_FAILED',
  'TOPOLOGY_HOST_FAILED',
  'TOPOLOGY_HOST_PORT_OCCUPIED',
  'TOPOLOGY_STALE_LOCATOR',
  'TOPOLOGY_INVALID_LOCATOR',
  'TOPOLOGY_ROLE_OCCUPIED',
  'TOPOLOGY_PROTOCOL_REJECTED',
  'TOPOLOGY_TIMEOUT',
  'TOPOLOGY_UNAVAILABLE',
  'TOPOLOGY_CODEC_FAILED',
  'TOPOLOGY_CHECKSUM_FAILED',
  'TOPOLOGY_DECODED_PAYLOAD_INVALID',
  'TOPOLOGY_REASSEMBLY_OVERFLOW',
  'TOPOLOGY_REASSEMBLY_TIMEOUT',
])

const readReasonCode = (result: CommandDispatchResult): TopologyFailureReasonCode | undefined => {
  const code = result.actorResults.find(actor => actor.error !== null)?.error?.code
  return reasonCodes.has(code as TopologyFailureReasonCode) ? code as TopologyFailureReasonCode : undefined
}

const readIdentity = (result: CommandDispatchResult): TopologyIdentity | undefined => {
  const value = result.actorResults.find(actor => actor.status === 'completed')?.result
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  if (Reflect.get(value, 'type') !== 'identity') return undefined
  const protocolVersion = Reflect.get(value, 'protocolVersion')
  const moduleName = Reflect.get(value, 'moduleName')
  const nodeId = Reflect.get(value, 'nodeId')
  const displayName = Reflect.get(value, 'displayName')
  const instanceMode = Reflect.get(value, 'instanceMode')
  const displayRole = Reflect.get(value, 'displayRole')
  if (protocolVersion !== 1 || typeof moduleName !== 'string' || typeof nodeId !== 'string' || typeof displayName !== 'string'
    || (instanceMode !== 'MASTER' && instanceMode !== 'SLAVE')
    || (displayRole !== 'CHIEF' && displayRole !== 'VICE')) return undefined
  return Object.freeze({
    protocolVersion: 1 as const,
    moduleName,
    nodeId,
    displayName,
    instanceMode,
    displayRole,
  })
}

const normalizeResult = (result: CommandDispatchResult): TopologyAdminCommandResult => Object.freeze({
  status: result.status === 'completed' || result.status === 'partial-failed' || result.status === 'timed-out'
    ? result.status
    : 'error',
  ...(readIdentity(result) === undefined ? {} : {identity: readIdentity(result)}),
  ...(readReasonCode(result) === undefined ? {} : {reasonCode: readReasonCode(result)}),
})

const failed = (reasonCode: TopologyFailureReasonCode = 'TOPOLOGY_UNAVAILABLE'): TopologyAdminCommandResult =>
  Object.freeze({status: 'error' as const, reasonCode})

const unavailableEligibility = (operation: TopologyOperation): TopologyOperationEligibility => Object.freeze({
  operation,
  allowed: false,
  reasonCode: 'TOPOLOGY_UNAVAILABLE',
})

const unavailablePage = (reasonCode: TopologyFailureReasonCode): TopologyPageAvailability => Object.freeze({
  available: false,
  reasonCode,
})

const routeContextForCurrentTopology = (runtime: TopologyAdminRuntime) => {
  const facts = selectTopologyFacts(runtime.getState())
  if (facts === undefined) throw new Error('Topology capability is unavailable')
  return Object.freeze({
    workspace: resolveWorkspace({instanceMode: facts.instanceMode, displayRole: facts.displayRole}),
    instanceMode: facts.instanceMode,
    displayMode: resolveSurfaceDisplayMode({
      displayIndex: 0,
      displayRole: facts.displayRole,
      instanceMode: facts.instanceMode,
    }),
  })
}

const dispatch = async <TPayload extends Parameters<Runtime['dispatchCommand']>[1]>(
  runtime: TopologyAdminRuntime,
  definition: Readonly<{readonly commandName: string}>,
  payload: TPayload,
): Promise<TopologyAdminCommandResult> => {
  try {
    const result = await runtime.dispatchCommand(definition.commandName, payload as StateJsonValue, {
      requestId: createRequestId(),
      routeContext: routeContextForCurrentTopology(runtime),
    })
    return normalizeResult(result)
  } catch {
    return failed()
  }
}

export const createTopologyAdminCapability = (runtime: TopologyAdminRuntime): TopologyAdminCapability => Object.freeze({
  getSnapshot: () => selectTopologyFacts(runtime.getState()),
  getPageAvailability: () => {
    const facts = selectTopologyFacts(runtime.getState())
    if (facts === undefined || facts.displayCount === null) return unavailablePage('TOPOLOGY_UNAVAILABLE')
    if (facts.surfaceForm !== 'laptop') return unavailablePage('TOPOLOGY_UNSUPPORTED_FORM')
    if (facts.displayCount !== 1) return unavailablePage('TOPOLOGY_REQUIRES_SINGLE_SCREEN')
    return Object.freeze({available: true, reasonCode: 'allowed' as const})
  },
  getOperationEligibility: (operation: TopologyOperation) => {
    const facts = selectTopologyFacts(runtime.getState())
    if (facts === undefined) return unavailableEligibility(operation)
    return evaluateTopologyOperation({
      operation,
      surfaceForm: facts.surfaceForm,
      displayCount: facts.displayCount,
      instanceMode: facts.instanceMode,
      displayRole: facts.displayRole,
      paired: facts.paired,
      peerReachable: facts.peerReachable,
    })
  },
  pairByHost: input => dispatch(runtime, pairByHostTopologyCommand, input),
  unpair: () => dispatch(runtime, unpairTopologyCommand, Object.freeze({})),
  setHostEnabled: enabled => dispatch(runtime, setTopologyHostEnabledCommand, Object.freeze({enabled})),
})
