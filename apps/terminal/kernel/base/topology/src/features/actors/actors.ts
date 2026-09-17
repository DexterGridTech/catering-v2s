import type {ActorDefinition, ActorExecutionContext, CommandDefinition} from '@catering-v2s/kernel-base-runtime'
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime'
import type {TopologyIdentityClient, TopologyPeerChannel} from '@catering-v2s/kernel-base-transport'
import {readDisplayInfo} from '@catering-v2s/kernel-base-display-context'
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import {
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '@catering-v2s/kernel-base-display-context'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import type {
  TopologyHostAddress,
  TopologyHostStatus,
  TopologyHostState,
} from '@catering-v2s/kernel-base-platform-ports'
import {
  pairTopologyCommand,
  queryTopologyHostCommand,
  reconcileTopologyHostCommand,
  reconcileTopologyPeerCommand,
  refreshTopologyDisplayCommand,
  setTopologyHostEnabledCommand,
  topologyHostEventCommand,
  unpairTopologyCommand,
} from '../commands/commands'
import {moduleName} from '../../moduleName'
import {topologyActions} from '../slices/topology'
import {selectTopologyState} from '../../selectors/selectTopologyState'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'

type TopologyActorInput = Readonly<{
  readonly identityClient?: TopologyIdentityClient
  readonly peerChannel?: TopologyPeerChannel
}>

const topologyCallTimeoutMs = 5_000

const hostStatusValue = (
  value: unknown,
): TopologyHostStatus | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const state = Reflect.get(value, 'state')
  if (state !== 'stopped' && state !== 'starting' && state !== 'running' && state !== 'stopping' && state !== 'error') {
    return undefined
  }
  const config = Reflect.get(value, 'config')
  if (typeof config !== 'object' || config === null) return undefined
  const port = Reflect.get(config, 'port')
  const basePath = Reflect.get(config, 'basePath')
  const heartbeatIntervalMs = Reflect.get(config, 'heartbeatIntervalMs')
  const heartbeatTimeoutMs = Reflect.get(config, 'heartbeatTimeoutMs')
  if (typeof port !== 'number' || typeof basePath !== 'string'
    || typeof heartbeatIntervalMs !== 'number' || typeof heartbeatTimeoutMs !== 'number') return undefined
  const address = Reflect.get(value, 'address')
  const readAddress = (candidate: unknown): TopologyHostAddress | undefined => {
    if (typeof candidate !== 'object' || candidate === null) return undefined
    const fields = ['host', 'httpBaseUrl', 'wsUrl', 'localHttpBaseUrl', 'localWsUrl']
    if (!fields.every(field => typeof Reflect.get(candidate, field) === 'string')) return undefined
    const addressPort = Reflect.get(candidate, 'port')
    const addressBasePath = Reflect.get(candidate, 'basePath')
    if (typeof addressPort !== 'number' || typeof addressBasePath !== 'string') return undefined
    return candidate as TopologyHostAddress
  }
  const normalizedAddress = readAddress(address)
  return Object.freeze({
    state: state as TopologyHostState,
    config: Object.freeze({port, basePath, heartbeatIntervalMs, heartbeatTimeoutMs}),
    ...(normalizedAddress === undefined ? {} : {address: normalizedAddress}),
    ...(typeof Reflect.get(value, 'errorCode') === 'string' ? {errorCode: Reflect.get(value, 'errorCode') as string} : {}),
    ...(typeof Reflect.get(value, 'errorMessage') === 'string' ? {errorMessage: Reflect.get(value, 'errorMessage') as string} : {}),
  })
}

const hostFailureCode = (result: Readonly<{readonly status: string; readonly error?: {readonly code?: string}}>): string =>
  result.status === 'failed' && typeof result.error?.code === 'string'
    ? result.error.code
    : 'TOPOLOGY_HOST_FAILED'

const hostStatusActionIfChanged = (
  context: ActorExecutionContext,
  nextState: TopologyHostState,
  errorCode?: string | null,
): ReturnType<typeof topologyActions.setHostStatus> | undefined => {
  const current = selectTopologyState(context.getState())
  const normalizedErrorCode = errorCode ?? null
  if (current.hostActual === nextState && current.hostErrorCode === normalizedErrorCode) return undefined
  return topologyActions.setHostStatus({state: nextState, errorCode: normalizedErrorCode})
}

const readHostStatus = async (context: ActorExecutionContext): Promise<
  | Readonly<{readonly status: 'succeeded'; readonly value: TopologyHostStatus}>
  | Readonly<{readonly status: 'failed'; readonly errorCode: string}>
> => {
  const result = await context.platformPorts.topologyHost.getStatus({timeoutMs: topologyCallTimeoutMs})
  if (result.status !== 'succeeded') return {status: 'failed', errorCode: hostFailureCode(result)}
  const value = hostStatusValue(result.value)
  return value === undefined
    ? {status: 'failed', errorCode: 'TOPOLOGY_HOST_FAILED'}
    : {status: 'succeeded', value}
}

const hostShouldRun = (context: ActorExecutionContext): boolean => {
  const topology = selectTopologyState(context.getState())
  const instanceMode = selectRuntimeInstanceMode(context.getState())
  return topology.hostDesired
    && instanceMode === 'MASTER'
    && topology.surfaceForm === 'laptop'
    && topology.displayCount === 1
}

const createTopologyHostIdentity = (context: ActorExecutionContext) => {
  const topology = selectTopologyState(context.getState())
  return Object.freeze({
    protocolVersion: 1 as const,
    nodeId: topology.nodeId,
    displayName: topology.displayName,
    instanceMode: selectRuntimeInstanceMode(context.getState()),
    displayRole: selectDisplayRole(context.getState()),
  })
}

const topologyPeerWsUrl = (locator: Readonly<{readonly host: string; readonly port: number; readonly basePath: string}>): string =>
  `ws://${locator.host}:${locator.port}${locator.basePath}/ws`

const childDispatchOptions = (context: ActorExecutionContext): Readonly<{
  readonly requestId?: import('@catering-v2s/kernel-base-contracts').RequestId
  readonly parentCommandId: import('@catering-v2s/kernel-base-contracts').CommandId
  readonly routeContext: import('@catering-v2s/kernel-base-contracts').CommandRouteContext | null
  readonly target: 'local'
}> => ({
  requestId: context.command.requestId ?? undefined,
  parentCommandId: context.command.commandId,
  routeContext: context.command.routeContext,
  target: 'local',
})

const dispatchCompleted = async <TPayload extends StateJsonValue>(input: Readonly<{
  readonly context: ActorExecutionContext
  readonly definition: CommandDefinition<TPayload>
  readonly payload: TPayload
  readonly label: string
}>): Promise<void> => {
  const result = await input.context.dispatchCommand(input.definition, input.payload, childDispatchOptions(input.context))
  if (result.status !== 'completed') throw new Error(`${input.label} did not complete: ${result.status}`)
}

const repairPairState = async (context: ActorExecutionContext): Promise<boolean> => {
  let repaired = true
  try {
    if (selectDisplayRole(context.getState()) !== 'CHIEF') {
      await dispatchCompleted({context, definition: switchDisplayRoleCommand, payload: Object.freeze({displayRole: 'CHIEF' as const}), label: 'Pair role repair'})
    }
    if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') {
      await dispatchCompleted({context, definition: switchInstanceModeCommand, payload: Object.freeze({instanceMode: 'MASTER' as const}), label: 'Pair mode repair'})
    }
  } catch (error) {
    repaired = false
    context.platformPorts.logger.withContext({
      commandId: context.command.commandId,
      commandName: context.command.commandName,
      nodeId: context.localNodeId,
    }).error({
      category: 'topology.pairing',
      event: 'topology.pairing.repair-failed',
      message: 'Topology pairing repair failed',
      error: {message: error instanceof Error ? error.message : 'pair repair failed'},
    })
  }
  if (repaired) {
    context.dispatchAction(topologyActions.clearMasterLocator())
    context.dispatchAction(topologyActions.setRepairPending(false))
  } else {
    context.dispatchAction(topologyActions.setRepairPending(true))
  }
  return repaired
}

const resetSlaveRuntime = async (context: ActorExecutionContext): Promise<void> => {
  const result = await context.platformPorts.appControl.resetRuntime({
    requestId: context.command.requestId ?? createRequestId(),
    timeoutMs: topologyCallTimeoutMs,
  })
  if (result.status !== 'accepted') {
    throw new Error(`Topology slave runtime reset did not complete: ${result.status}`)
  }
}

export const createTopologyActor = (input: TopologyActorInput = {}): ActorDefinition => defineActor(moduleName, 'operations', [
  onCommand(queryTopologyHostCommand, async context => {
    const host = context.command.payload.host.trim()
    if (host.length === 0) throw new Error('Topology host is empty')
    if (!input.identityClient) throw new Error('Topology identity client unavailable')
    return input.identityClient.query(host)
  }),
  onCommand(pairTopologyCommand, async context => {
    const payload = context.command.payload
    const current = selectTopologyState(context.getState())
    if (current.masterLocator !== null) throw new Error('Topology is already paired')
    if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER' || selectDisplayRole(context.getState()) !== 'CHIEF') {
      throw new Error('Topology pairing requires MASTER and CHIEF')
    }
    context.dispatchAction(topologyActions.setRepairPending(true))
    context.dispatchAction(topologyActions.setMasterLocator(payload.locator))
    context.dispatchAction(topologyActions.setPeerIdentity(payload.locator.identity))
    try {
      await dispatchCompleted({context, definition: switchInstanceModeCommand, payload: Object.freeze({instanceMode: 'SLAVE' as const}), label: 'Topology instance mode switch'})
      await dispatchCompleted({context, definition: switchDisplayRoleCommand, payload: Object.freeze({displayRole: 'VICE' as const}), label: 'Topology display role switch'})
      const persistence = await context.flushPersistence()
      if (persistence.status !== 'succeeded') throw new Error(`Topology pairing persistence did not complete: ${persistence.status}`)
      await resetSlaveRuntime(context)
      return null
    } catch (error) {
      await repairPairState(context)
      throw error
    }
  }),
  onCommand(unpairTopologyCommand, async context => {
    const current = selectTopologyState(context.getState())
    if (current.masterLocator === null) throw new Error('Topology is not paired')
    context.dispatchAction(topologyActions.setRepairPending(true))
    try {
      if (selectDisplayRole(context.getState()) !== 'CHIEF') {
        await dispatchCompleted({context, definition: switchDisplayRoleCommand, payload: Object.freeze({displayRole: 'CHIEF' as const}), label: 'Topology display role unpair'})
      }
      if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') {
        await dispatchCompleted({context, definition: switchInstanceModeCommand, payload: Object.freeze({instanceMode: 'MASTER' as const}), label: 'Topology instance mode unpair'})
      }
      context.dispatchAction(topologyActions.clearMasterLocator())
      context.dispatchAction(topologyActions.setRepairPending(false))
      await input.peerChannel?.close('TOPOLOGY_UNPAIRED')
      return null
    } catch (error) {
      context.dispatchAction(topologyActions.setRepairPending(true))
      throw error
    }
  }),
  onCommand(setTopologyHostEnabledCommand, async context => {
    context.dispatchAction(topologyActions.setHostDesired(context.command.payload.enabled))
    return null
  }),
  onCommand(topologyHostEventCommand, async context => {
    const event = context.command.payload
    if (event.event === 'peer-accepted') {
      if (event.peerIdentity !== undefined) context.dispatchAction(topologyActions.setPeerIdentity(event.peerIdentity))
      context.dispatchAction(topologyActions.setPeerReachable(true))
    }
    if (event.event === 'close' || event.event === 'error' || event.event === 'peer-unreachable') {
      context.dispatchAction(topologyActions.setPeerReachable(false))
      context.dispatchAction(topologyActions.bumpPeerConnectionRevision())
    }
    return null
  }),
  onCommand(refreshTopologyDisplayCommand, async context => {
    const displayInfo = await readDisplayInfo(context.platformPorts.device)
    const displayCount = displayInfo.status === 'valid' ? displayInfo.displayCount : null
    const current = selectTopologyState(context.getState())
    if (current.displayCount !== displayCount) context.dispatchAction(topologyActions.setDisplayCount(displayCount))
    return Object.freeze({status: displayInfo.status, displayCount})
  }),
  onCommand(reconcileTopologyHostCommand, async context => {
    const shouldRun = hostShouldRun(context)
    const status = await readHostStatus(context)
    if (!shouldRun) {
      if (status.status === 'succeeded' && status.value.state === 'stopped') {
        const action = hostStatusActionIfChanged(context, 'stopped')
        if (action !== undefined) context.dispatchAction(action)
        return Object.freeze({state: 'stopped' as const, desired: false})
      }
      const stoppingAction = hostStatusActionIfChanged(context, 'stopping')
      if (stoppingAction !== undefined) context.dispatchAction(stoppingAction)
      const stopped = await context.platformPorts.topologyHost.stop({timeoutMs: topologyCallTimeoutMs})
      if (stopped.status !== 'succeeded') {
        const errorCode = hostFailureCode(stopped)
        const errorAction = hostStatusActionIfChanged(context, 'error', errorCode)
        if (errorAction !== undefined) context.dispatchAction(errorAction)
        return Object.freeze({state: 'error' as const, desired: false, errorCode})
      }
      const stoppedAction = hostStatusActionIfChanged(context, 'stopped')
      if (stoppedAction !== undefined) context.dispatchAction(stoppedAction)
      return Object.freeze({state: 'stopped' as const, desired: false})
    }

    if (status.status === 'succeeded' && status.value.state === 'running' && status.value.address !== undefined) {
      const runningAction = hostStatusActionIfChanged(context, 'running')
      if (runningAction !== undefined) context.dispatchAction(runningAction)
      return Object.freeze({state: 'running' as const, desired: true})
    }

    const startingAction = hostStatusActionIfChanged(context, 'starting')
    if (startingAction !== undefined) context.dispatchAction(startingAction)
    const started = await context.platformPorts.topologyHost.start({
      port: 43172,
      basePath: '/terminal-topology',
      heartbeatIntervalMs: 10_000,
      heartbeatTimeoutMs: 30_000,
      timeoutMs: topologyCallTimeoutMs,
      identity: createTopologyHostIdentity(context),
    })
    if (started.status !== 'succeeded') {
      const errorCode = hostFailureCode(started)
      const errorAction = hostStatusActionIfChanged(context, 'error', errorCode)
      if (errorAction !== undefined) context.dispatchAction(errorAction)
      return Object.freeze({state: 'error' as const, desired: true, errorCode})
    }
    const settled = await readHostStatus(context)
    if (settled.status !== 'succeeded' || settled.value.state !== 'running' || settled.value.address === undefined) {
      const errorCode = settled.status === 'failed' ? settled.errorCode : 'TOPOLOGY_HOST_FAILED'
      const errorAction = hostStatusActionIfChanged(context, 'error', errorCode)
      if (errorAction !== undefined) context.dispatchAction(errorAction)
      return Object.freeze({state: 'error' as const, desired: true, errorCode})
    }
    const runningAction = hostStatusActionIfChanged(context, 'running')
    if (runningAction !== undefined) context.dispatchAction(runningAction)
    return Object.freeze({state: 'running' as const, desired: true})
  }),
  onCommand(reconcileTopologyPeerCommand, async context => {
    const topology = selectTopologyState(context.getState())
    const instanceMode = selectRuntimeInstanceMode(context.getState())
    if (input.peerChannel === undefined || instanceMode !== 'SLAVE' || topology.masterLocator === null || topology.repairPending) {
      return Object.freeze({connected: false, reason: 'not-configured'})
    }
    await input.peerChannel.connect(topologyPeerWsUrl(topology.masterLocator))
    return Object.freeze({connected: true})
  }),
])
