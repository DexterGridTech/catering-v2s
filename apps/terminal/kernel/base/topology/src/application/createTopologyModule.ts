import {
  createEnvelopeId,
  createNodeId,
  type CommandId,
  type RequestId,
  type SurfaceForm,
  type TopologyIdentity,
  type TopologyJsonValue,
  type TopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts'
import type {
  CommandDispatchResult,
  PeerDispatchOptions,
  RuntimeModule,
  RuntimeModuleContext,
} from '@catering-v2s/kernel-base-runtime'
import {
  selectRuntimeInstanceMode,
  type CommandIntent,
} from '@catering-v2s/kernel-base-runtime'
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context'
import type {
  StateJsonValue,
  SyncStateDiff,
} from '@catering-v2s/kernel-base-state'
import type {
  TopologyIdentityClient,
  TopologyPeerChannel,
} from '@catering-v2s/kernel-base-transport'
import {createTopologySession, type TopologySession} from '@catering-v2s/kernel-base-transport'
import {runtimeModuleDependencyNames} from '../dependencies'
import {moduleKind, moduleName} from '../moduleName'
import {createTopologyActor} from '../features/actors/actors'
import {
  pairTopologyCommand,
  queryTopologyHostCommand,
  reconcileTopologyHostCommand,
  reconcileTopologyPeerCommand,
  refreshTopologyDisplayCommand,
  setTopologyHostEnabledCommand,
  topologyHostEventCommand,
  type TopologyHostEventPayload,
  unpairTopologyCommand,
} from '../features/commands/commands'
import {createTopologySlice} from '../features/slices/topology'
import {topologySliceName} from '../selectors/selectTopologyState'
import type {TopologyState} from '../types/state'

export type CreateTopologyModuleInput = Readonly<{
  readonly displayName: string
  readonly surfaceForm: SurfaceForm
  readonly nodeId?: string
  readonly identityClient?: TopologyIdentityClient
  readonly peerChannel?: TopologyPeerChannel
}>

const membersSliceName = 'kernel.feature.sample-member-registry.members' as const
const topologyPort = 43172
const topologyBasePath = '/terminal-topology'
const reconnectBaseDelayMs = 500
const reconnectMaxDelayMs = 10_000

const asCommandId = (value: string): CommandId => value as CommandId
const asRequestId = (value: string): RequestId => value as RequestId

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isJsonValue = (value: unknown): value is StateJsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (!isRecord(value)) return false
  return Object.values(value).every(isJsonValue)
}

const readSyncStateDiff = (value: TopologyJsonValue): SyncStateDiff | undefined => {
  if (!isRecord(value) || value.mode !== 'authoritative' || value.replaceMissing !== true || !Array.isArray(value.entries)) {
    return undefined
  }
  const entries: Array<SyncStateDiff['entries'][number]> = []
  for (const candidate of value.entries) {
    if (!isRecord(candidate) || typeof candidate.key !== 'string' || !isRecord(candidate.value)) return undefined
    const envelope = candidate.value
    if (typeof envelope.updatedAt !== 'number') return undefined
    if (envelope.tombstone === true) {
      if ('value' in envelope) return undefined
      entries.push({key: candidate.key, value: {updatedAt: envelope.updatedAt, tombstone: true}})
      continue
    }
    if (!('value' in envelope) || !isJsonValue(envelope.value)) return undefined
    entries.push({key: candidate.key, value: {updatedAt: envelope.updatedAt, value: envelope.value}})
  }
  return {mode: 'authoritative', replaceMissing: true, entries}
}

const topologyPeerWsUrl = (locator: Readonly<{readonly host: string; readonly port: number; readonly basePath: string}>): string =>
  `ws://${locator.host}:${locator.port}${locator.basePath}/ws`

const createLocalIdentity = (state: import('@catering-v2s/kernel-base-state').StateRoot): TopologyIdentity => {
  const topology = state[topologySliceName] as TopologyState
  return Object.freeze({
    protocolVersion: 1,
    nodeId: topology.nodeId,
    displayName: topology.displayName,
    instanceMode: selectRuntimeInstanceMode(state),
    displayRole: selectDisplayRole(state),
  })
}

const isExpectedPeer = (state: import('@catering-v2s/kernel-base-state').StateRoot, peerNodeId: string): boolean => {
  const topology = state[topologySliceName] as TopologyState
  const expectedNodeId = topology.masterLocator?.identity.nodeId
  return expectedNodeId === undefined || expectedNodeId === peerNodeId
}

const commandResultForRemote = (
  requestId: string | null,
  commandId: string,
  status: CommandDispatchResult['status'],
): CommandDispatchResult => Object.freeze({
  requestId: requestId === null ? null : asRequestId(requestId),
  commandId: asCommandId(commandId),
  status,
  actorResults: [],
})

export const createTopologyModule = (input: CreateTopologyModuleInput): RuntimeModule => {
  const actor = createTopologyActor({identityClient: input.identityClient, peerChannel: input.peerChannel})
  const commands = [
    queryTopologyHostCommand,
    pairTopologyCommand,
    unpairTopologyCommand,
    setTopologyHostEnabledCommand,
    topologyHostEventCommand,
    refreshTopologyDisplayCommand,
    reconcileTopologyHostCommand,
    reconcileTopologyPeerCommand,
  ] as const
  const slice = createTopologySlice({
    nodeId: input.nodeId ?? String(createNodeId()),
    displayName: input.displayName,
    surfaceForm: input.surfaceForm,
  })

  let active = true
  let scheduled = false
  let reconciling = false
  let rerun = false
  let lastHostSignature: string | undefined
  let lastPeerSignature: string | undefined
  let currentSession: TopologySession | undefined
  let currentConnectionId: string | undefined
  let closingConnectionId: string | undefined
  let peerAccepted = false
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let reconnectAttempt = 0
  let membersSyncRevision = 0
  let lastMembersFingerprint: string | undefined
  let lastReceivedMembersRevision = 0
  const pendingPeerCommands = new Map<string, {readonly resolve: (result: CommandDispatchResult) => void; readonly reject: (error: Error) => void}>()
  const cancelledRemoteCommands = new Set<string>()

  const dispatchTopologyEvent = (context: RuntimeModuleContext, payload: TopologyHostEventPayload): void => {
    void context.dispatchCommand(topologyHostEventCommand, Object.freeze(payload)).catch(() => undefined)
  }

  const rejectPendingPeerCommands = (error: Error): void => {
    for (const pending of pendingPeerCommands.values()) pending.reject(error)
    pendingPeerCommands.clear()
  }

  const sendMessage = (message: TopologyWireMessage): void => {
    const session = currentSession
    if (session === undefined || session.state() !== 'open') throw new Error('topology peer session is not open')
    session.send(message)
  }

  const sendHello = (context: RuntimeModuleContext): void => {
    const identity = createLocalIdentity(context.getState())
    sendMessage({
      type: 'hello',
      protocolVersion: 1,
      wireId: String(createEnvelopeId()),
      nodeId: identity.nodeId,
      displayName: identity.displayName,
      instanceMode: identity.instanceMode,
      displayRole: identity.displayRole,
    })
  }

  const sendMembersSnapshot = (context: RuntimeModuleContext, force = false): void => {
    const state = context.getState()
    const topology = state[topologySliceName] as TopologyState | undefined
    if (topology === undefined || selectRuntimeInstanceMode(state) !== 'MASTER' || !peerAccepted || currentSession === undefined) return
    if (state[membersSliceName] === undefined) return
    const payload = context.createFullSyncPayload(membersSliceName)
    if (payload.status !== 'ready') return
    const fingerprint = JSON.stringify(payload.payload)
    if (!force && fingerprint === lastMembersFingerprint) return
    lastMembersFingerprint = fingerprint
    membersSyncRevision += 1
    sendMessage({
      type: 'state-full',
      protocolVersion: 1,
      wireId: String(createEnvelopeId()),
      sliceName: membersSliceName,
      direction: 'master-to-slave',
      revision: membersSyncRevision,
      value: payload.payload as unknown as TopologyJsonValue,
    })
  }

  const markPeerAccepted = (context: RuntimeModuleContext, peerIdentity?: TopologyIdentity): void => {
    peerAccepted = true
    reconnectAttempt = 0
    if (peerIdentity !== undefined) dispatchTopologyEvent(context, {event: 'peer-accepted', peerIdentity})
    else dispatchTopologyEvent(context, {event: 'peer-accepted'})
    sendMembersSnapshot(context, true)
  }

  const handlePeerLoss = (context: RuntimeModuleContext, reason: string, connectionId?: string): void => {
    if (!active) return
    if (connectionId !== undefined && currentConnectionId !== undefined && connectionId !== currentConnectionId) return
    if (connectionId !== undefined && closingConnectionId === connectionId) return
    const previousSession = currentSession
    const lostConnectionId = connectionId ?? currentConnectionId
    if (lostConnectionId !== undefined) closingConnectionId = lostConnectionId
    peerAccepted = false
    currentSession = undefined
    currentConnectionId = undefined
    previousSession?.close(reason)
    rejectPendingPeerCommands(new Error(reason))
    dispatchTopologyEvent(context, {event: 'peer-unreachable', reason})
    const topology = context.getState()[topologySliceName] as TopologyState | undefined
    const mode = selectRuntimeInstanceMode(context.getState())
    if (!active || topology === undefined || topology.masterLocator === null || mode !== 'SLAVE' || topology.repairPending) return
    if (reconnectTimer !== undefined) return
    const delay = Math.min(reconnectMaxDelayMs, reconnectBaseDelayMs * (2 ** reconnectAttempt))
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      if (active) schedule(context)
    }, delay)
  }

  const handleWireMessage = (context: RuntimeModuleContext, message: TopologyWireMessage): void => {
    if (!peerAccepted && message.type !== 'hello' && message.type !== 'hello-accepted' && message.type !== 'hello-rejected') return
    if (message.type === 'hello') {
      const state = context.getState()
      const localMode = selectRuntimeInstanceMode(state)
      const acceptable = (localMode === 'MASTER' && message.instanceMode === 'SLAVE')
        || (localMode === 'SLAVE' && message.instanceMode === 'MASTER')
      if (!acceptable || (localMode === 'SLAVE' && !isExpectedPeer(state, message.nodeId))) {
        sendMessage({
          type: 'hello-rejected',
          protocolVersion: 1,
          wireId: String(createEnvelopeId()),
          error: {
            code: acceptable ? 'TOPOLOGY_STALE_LOCATOR' : 'TOPOLOGY_ROLE_OCCUPIED',
            retryable: false,
          },
        })
        handlePeerLoss(context, 'TOPOLOGY_HELLO_REJECTED')
        return
      }
      sendMessage({
        type: 'hello-accepted',
        protocolVersion: 1,
        wireId: String(createEnvelopeId()),
        nodeId: createLocalIdentity(state).nodeId,
      })
      markPeerAccepted(context, Object.freeze({
        protocolVersion: 1,
        nodeId: message.nodeId,
        displayName: message.displayName,
        instanceMode: message.instanceMode,
        displayRole: message.displayRole,
      }))
      return
    }
    if (message.type === 'hello-accepted') {
      const state = context.getState()
      if (selectRuntimeInstanceMode(state) !== 'SLAVE' || !isExpectedPeer(state, message.nodeId)) {
        handlePeerLoss(context, 'TOPOLOGY_HELLO_ACCEPTED_IDENTITY_MISMATCH')
        return
      }
      markPeerAccepted(context, Object.freeze({
        protocolVersion: 1,
        nodeId: message.nodeId,
        displayName: (state[topologySliceName] as TopologyState | undefined)?.displayName ?? 'TER peer',
        instanceMode: 'MASTER',
        displayRole: 'CHIEF',
      }))
      return
    }
    if (message.type === 'hello-rejected') {
      handlePeerLoss(context, message.error.code)
      return
    }
    if (message.type === 'closed-error') {
      handlePeerLoss(context, message.error.code)
      return
    }
    if (message.type === 'ping') {
      sendMessage({type: 'pong', protocolVersion: 1, wireId: String(createEnvelopeId()), sequence: message.sequence})
      return
    }
    if (message.type === 'pong') return
    if (message.type === 'command-cancel') {
      cancelledRemoteCommands.add(message.commandId)
      return
    }
    if (message.type === 'command-result') {
      const pending = pendingPeerCommands.get(message.commandId)
      if (pending === undefined) return
      pendingPeerCommands.delete(message.commandId)
      pending.resolve(commandResultForRemote(message.requestId, message.commandId, message.status))
      return
    }
    if (message.type === 'state-full') {
      const state = context.getState()
      if (selectRuntimeInstanceMode(state) !== 'SLAVE' || message.direction !== 'master-to-slave') return
      if (message.revision <= lastReceivedMembersRevision) return
      const diff = readSyncStateDiff(message.value)
      if (diff === undefined) {
        handlePeerLoss(context, 'TOPOLOGY_STATE_PAYLOAD_INVALID')
        return
      }
      const applied = context.applyAuthoritativeSync(message.sliceName, diff)
      if (applied.status === 'skipped') {
        handlePeerLoss(context, `TOPOLOGY_STATE_APPLY_${applied.reason}`)
        return
      }
      lastReceivedMembersRevision = message.revision
      return
    }
    if (message.type === 'command-request') {
      const commandId = asCommandId(message.commandId)
      const requestId = message.requestId === null ? undefined : asRequestId(message.requestId)
      void context.dispatchCommand(
        message.commandName,
        message.payload as unknown as StateJsonValue,
        {
          requestId,
          commandId,
          parentCommandId: message.parentCommandId === null ? undefined : asCommandId(message.parentCommandId),
          routeContext: null,
          target: 'local',
        },
      ).then(result => {
        if (cancelledRemoteCommands.delete(message.commandId)) return
        sendMessage({
          type: 'command-result',
          protocolVersion: 1,
          wireId: String(createEnvelopeId()),
          requestId: message.requestId,
          commandId: message.commandId,
          status: result.status === 'completed' ? 'completed' : result.status === 'timed-out' ? 'timed-out' : result.status === 'partial-failed' ? 'partial-failed' : 'error',
          result: null,
          error: result.status === 'completed' ? null : {code: 'TOPOLOGY_UNAVAILABLE', retryable: result.status !== 'timed-out'},
        })
      }).catch(() => {
        if (cancelledRemoteCommands.delete(message.commandId)) return
        sendMessage({
          type: 'command-result',
          protocolVersion: 1,
          wireId: String(createEnvelopeId()),
          requestId: message.requestId,
          commandId: message.commandId,
          status: 'error',
          result: null,
          error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: true},
        })
      })
    }
  }

  const installPeerSession = (context: RuntimeModuleContext, connectionId?: string): void => {
    peerAccepted = false
    closingConnectionId = undefined
    currentConnectionId = connectionId
    currentSession = createTopologySession({
      write: raw => { void input.peerChannel?.send(raw).catch(error => handlePeerLoss(context, error instanceof Error ? error.message : 'TOPOLOGY_WRITE_FAILED', connectionId)) },
      onMessage: message => handleWireMessage(context, message),
      onProtocolError: error => handlePeerLoss(context, error.message, connectionId),
      closeTransport: reason => { void input.peerChannel?.close(reason) },
    })
    currentSession.markOpen()
    sendHello(context)
  }

  const installPeerGateway = (context: RuntimeModuleContext): void => {
    context.installPeerDispatchGateway({
      dispatchCommand: <TPayload extends StateJsonValue>(command: CommandIntent<TPayload>, options: PeerDispatchOptions): Promise<CommandDispatchResult> => {
        if (!peerAccepted || currentSession === undefined) return Promise.reject(new Error('Topology peer is not reachable'))
        const commandId = String(options.commandId)
        return new Promise<CommandDispatchResult>((resolve, reject) => {
          pendingPeerCommands.set(commandId, {resolve, reject})
          try {
            sendMessage({
              type: 'command-request',
              protocolVersion: 1,
              wireId: String(createEnvelopeId()),
              requestId: options.requestId === null ? null : String(options.requestId),
              commandId,
              parentCommandId: options.parentCommandId === null ? null : String(options.parentCommandId),
              commandName: command.definition.commandName,
              payload: command.payload as unknown as TopologyJsonValue,
            })
          } catch (error) {
            pendingPeerCommands.delete(commandId)
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })
      },
      cancelCommand: async commandId => {
        if (!peerAccepted || currentSession === undefined) return
        sendMessage({
          type: 'command-cancel',
          protocolVersion: 1,
          wireId: String(createEnvelopeId()),
          requestId: null,
          commandId: String(commandId),
        })
      },
    })
  }

  const schedule = (context: RuntimeModuleContext): void => {
    if (!active) return
    if (reconciling) {
      rerun = true
      return
    }
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      if (!active) return
      const state = context.getState()
      const topology = state[topologySliceName] as TopologyState | undefined
      if (topology === undefined) return
      const instanceMode = selectRuntimeInstanceMode(state)
      const hostSignature = [
        topology.hostDesired,
        topology.surfaceForm,
        topology.displayCount,
        instanceMode,
        selectDisplayRole(state),
        topology.nodeId,
      ].join('|')
      const peerSignature = [
        instanceMode,
        topology.masterLocator?.host ?? '',
        topology.masterLocator?.port ?? '',
        topology.masterLocator?.basePath ?? '',
        topology.peerConnectionRevision,
        topology.repairPending,
      ].join('|')
      const needsHost = hostSignature !== lastHostSignature
      const needsPeer = peerSignature !== lastPeerSignature
      lastHostSignature = hostSignature
      lastPeerSignature = peerSignature
      if (!needsHost && !needsPeer) {
        sendMembersSnapshot(context)
        return
      }
      reconciling = true
      void Promise.all([
        needsHost ? context.dispatchCommand(reconcileTopologyHostCommand, Object.freeze({})) : Promise.resolve(),
        needsPeer ? context.dispatchCommand(reconcileTopologyPeerCommand, Object.freeze({})) : Promise.resolve(),
      ]).finally(() => {
        reconciling = false
        sendMembersSnapshot(context)
        if (rerun) {
          rerun = false
          schedule(context)
        }
      })
    })
  }

  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [{name: topologySliceName, persistIntent: slice.persistIntent}],
    stateSlices: [slice],
    install: async (context: RuntimeModuleContext) => {
      installPeerGateway(context)
      const unsubscribeState = context.subscribeState(() => {
        sendMembersSnapshot(context)
        schedule(context)
      })
      context.registerResource(() => {
        active = false
        if (reconnectTimer !== undefined) clearTimeout(reconnectTimer)
        reconnectTimer = undefined
        rejectPendingPeerCommands(new Error('Topology module disposed'))
        const session = currentSession
        currentSession = undefined
        currentConnectionId = undefined
        session?.close('TOPOLOGY_MODULE_DISPOSED')
        unsubscribeState()
        void input.peerChannel?.dispose()
      })
      if (input.peerChannel !== undefined) {
        input.peerChannel.listen()
        const unsubscribePeer = input.peerChannel.subscribe(event => {
          if (event.type === 'open') installPeerSession(context, event.connectionId)
          else if (event.type === 'message') {
            if (event.connectionId !== undefined && currentConnectionId !== undefined && event.connectionId !== currentConnectionId) return
            try { currentSession?.receive(event.raw) } catch { /* session reports protocol errors */ }
          } else handlePeerLoss(context, event.reason ?? `TOPOLOGY_PEER_${event.type.toUpperCase()}`, event.connectionId)
        })
        context.registerResource(unsubscribePeer)
      }
      await context.dispatchCommand(refreshTopologyDisplayCommand, Object.freeze({}))
      schedule(context)
    },
  })
}
