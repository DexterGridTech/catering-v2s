import {
  cleanupRequestLedgerCommand,
  initializeCommand,
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
import {moduleName} from '../moduleName'
import type {
  RuntimeModule,
  RuntimeRoleChangeEffect,
  RuntimeRoleChangeSignal,
} from '../types/module'
import {createSetRuntimeInstanceModeActor} from '../features/actors/setRuntimeInstanceModeActor'
import {createCleanupRequestLedgerActor} from '../features/actors/cleanupRequestLedgerActor'
import {
  defaultRequestMaxResidenceMs,
  defaultRequestRetentionMs,
  type RuntimeLimits,
} from '../types/limits'

export const createInternalRuntimeModule = (
  roleEffects: readonly RuntimeRoleChangeEffect[] = [],
  onRoleChange?: (signal: RuntimeRoleChangeSignal) => void,
  getRequestLedgerLimits: () => Pick<RuntimeLimits, 'requestRetentionMs' | 'requestMaxResidenceMs'> = () => ({
    requestRetentionMs: defaultRequestRetentionMs,
    requestMaxResidenceMs: defaultRequestMaxResidenceMs,
  }),
): RuntimeModule => {
  const actor = createSetRuntimeInstanceModeActor(roleEffects, onRoleChange)
  const cleanupActor = createCleanupRequestLedgerActor(getRequestLedgerLimits)

  return Object.freeze({
    moduleName,
    kind: 'owner' as const,
    dependencies: [],
    commands: [
      {name: `${moduleName}.initialize`, visibility: 'internal' as const},
      {name: `${moduleName}.set-instance-mode`, visibility: 'internal' as const},
      {name: `${moduleName}.cleanup-request-ledger`, visibility: 'internal' as const},
    ],
    commandDefinitions: [initializeCommand, setRuntimeInstanceModeCommand, cleanupRequestLedgerCommand],
    actors: [{name: 'instance-mode'}, {name: 'request-ledger-cleanup'}],
    actorDefinitions: [actor, cleanupActor],
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
