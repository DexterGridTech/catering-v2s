import {
  cleanupRequestLedgerCommand,
  initializeCommand,
  runtimeInstanceModeChangedCommand,
  setRuntimeInstanceModeCommand,
} from '../features/commands'
import {
  runtimeInstanceModeSlice,
  runtimeInstanceModeSliceName,
} from '../features/slices/runtimeInstanceMode'
import {
  runtimeRequestLedgerMasterSlice,
  runtimeRequestLedgerMasterSliceName,
  runtimeRequestLedgerSlaveSlice,
  runtimeRequestLedgerSlaveSliceName,
} from '../features/slices/requestLedger'
import {moduleKind, moduleName} from '../moduleName'
import type {
  RuntimeModule,
  RuntimeRoleChangeSignal,
} from '../types/module'
import {createSetRuntimeInstanceModeActor} from '../features/actors/setRuntimeInstanceModeActor'
import {createCleanupRequestLedgerActor} from '../features/actors/cleanupRequestLedgerActor'
import {createRequestLedgerRoleChangedActor} from '../features/actors/requestLedgerRoleChangedActor'
import {
  defaultRequestMaxResidenceMs,
  defaultRequestRetentionMs,
  type RuntimeLimits,
} from '../types/limits'

export const createInternalRuntimeModule = (
  onRoleChange?: (signal: RuntimeRoleChangeSignal) => void,
  getRequestLedgerLimits: () => Pick<RuntimeLimits, 'requestRetentionMs' | 'requestMaxResidenceMs'> = () => ({
    requestRetentionMs: defaultRequestRetentionMs,
    requestMaxResidenceMs: defaultRequestMaxResidenceMs,
  }),
): RuntimeModule => {
  const actor = createSetRuntimeInstanceModeActor(onRoleChange)
  const cleanupActor = createCleanupRequestLedgerActor(getRequestLedgerLimits)
  const roleChangedActor = createRequestLedgerRoleChangedActor()

  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: [],
    commands: [
      {name: `${moduleName}.initialize`, visibility: 'internal' as const},
      {name: `${moduleName}.set-instance-mode`, visibility: 'internal' as const},
      {name: `${moduleName}.cleanup-request-ledger`, visibility: 'internal' as const},
      {name: `${moduleName}.instance-mode-changed`, visibility: 'internal' as const},
    ],
    commandDefinitions: [initializeCommand, setRuntimeInstanceModeCommand, cleanupRequestLedgerCommand, runtimeInstanceModeChangedCommand],
    actors: [{name: 'instance-mode'}, {name: 'request-ledger-cleanup'}, {name: 'request-ledger-role-changed'}],
    actorDefinitions: [actor, cleanupActor, roleChangedActor],
    slices: [
      {name: runtimeInstanceModeSliceName, persistIntent: 'owner-only' as const},
      {name: runtimeRequestLedgerMasterSliceName, persistIntent: 'never' as const},
      {name: runtimeRequestLedgerSlaveSliceName, persistIntent: 'never' as const},
    ],
    stateSlices: [
      runtimeInstanceModeSlice,
      runtimeRequestLedgerMasterSlice,
      runtimeRequestLedgerSlaveSlice,
    ],
  })
}
