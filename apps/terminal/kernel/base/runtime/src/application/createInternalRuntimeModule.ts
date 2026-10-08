import {
  cleanupRequestLedgerCommand,
  initializeCommand,
  runtimeInstanceModeChangedCommand,
  setRuntimeInstanceModeCommand,
  helloWorldCommand,
  primarySurfaceReadyCommand,
} from '../features/commands';
import {runtimeInstanceModeSlice, runtimeInstanceModeSliceName} from '../features/slices/runtimeInstanceMode';
import {
  runtimeRequestLedgerMasterSlice,
  runtimeRequestLedgerMasterSliceName,
  runtimeRequestLedgerSlaveSlice,
  runtimeRequestLedgerSlaveSliceName,
} from '../features/slices/requestLedger';
import {moduleKind, moduleName} from '../moduleName';
import type {RuntimeModule, RuntimeRoleChangeSignal} from '../types/module';
import {createSetRuntimeInstanceModeActor} from '../features/actors/setRuntimeInstanceModeActor';
import {createCleanupRequestLedgerActor} from '../features/actors/cleanupRequestLedgerActor';
import {createRequestLedgerRoleChangedActor} from '../features/actors/requestLedgerRoleChangedActor';
import {createResetRuntimeAfterSystemFailureActor} from '../features/actors/resetRuntimeAfterSystemFailureActor';
import {createHelloWorldActor} from '../features/actors/helloWorldActor';
import {resetRuntimeAfterSystemFailureCommand} from '../features/commands/resetRuntimeAfterSystemFailure';
import {defaultRequestMaxResidenceMs, defaultRequestRetentionMs, type RuntimeLimits} from '../types/limits';
import {selectRequestExecutionView} from '../selectors/selectRequestExecutionView';
import {selectRequestExecutionCommands, selectRequestExecutionViews} from '../selectors/selectRequestExecutionViews';
import {selectRequestExecutionCandidates} from '../selectors/selectRequestExecutionCandidates';
import {selectRuntimeInstanceMode} from '../selectors/selectRuntimeInstanceMode';

export const createInternalRuntimeModule = (
  onRoleChange?: (signal: RuntimeRoleChangeSignal) => void,
  getRequestLedgerLimits: () => Pick<RuntimeLimits, 'requestRetentionMs' | 'requestMaxResidenceMs'> = () => ({
    requestRetentionMs: defaultRequestRetentionMs,
    requestMaxResidenceMs: defaultRequestMaxResidenceMs,
  }),
): RuntimeModule => {
  const actor = createSetRuntimeInstanceModeActor(onRoleChange);
  const cleanupActor = createCleanupRequestLedgerActor(getRequestLedgerLimits);
  const roleChangedActor = createRequestLedgerRoleChangedActor();
  const resetRuntimeAfterSystemFailureActor = createResetRuntimeAfterSystemFailureActor();
  const helloWorldActor = createHelloWorldActor();

  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: [],
    commands: [
      {name: `${moduleName}.initialize`, visibility: 'internal' as const},
      {name: `${moduleName}.set-instance-mode`, visibility: 'internal' as const},
      {name: `${moduleName}.cleanup-request-ledger`, visibility: 'internal' as const},
      {name: `${moduleName}.instance-mode-changed`, visibility: 'internal' as const},
      {name: `${moduleName}.primary-surface-ready`, visibility: 'internal' as const},
      {name: resetRuntimeAfterSystemFailureCommand.commandName, visibility: 'public' as const},
      {name: helloWorldCommand.commandName, visibility: 'public' as const},
    ],
    commandDefinitions: [
      initializeCommand,
      setRuntimeInstanceModeCommand,
      cleanupRequestLedgerCommand,
      runtimeInstanceModeChangedCommand,
      primarySurfaceReadyCommand,
      resetRuntimeAfterSystemFailureCommand,
      helloWorldCommand,
    ],
    selectorDefinitions: [
      selectRequestExecutionView,
      selectRequestExecutionViews,
      selectRequestExecutionCommands,
      selectRequestExecutionCandidates,
      selectRuntimeInstanceMode,
    ],
    actors: [
      {name: 'instance-mode'},
      {name: 'request-ledger-cleanup'},
      {name: 'request-ledger-role-changed'},
      {name: 'reset-runtime-after-system-failure'},
      {name: 'hello-world'},
    ],
    actorDefinitions: [actor, cleanupActor, roleChangedActor, resetRuntimeAfterSystemFailureActor, helloWorldActor],
    slices: [
      {name: runtimeInstanceModeSliceName, persistIntent: 'owner-only' as const},
      {name: runtimeRequestLedgerMasterSliceName, persistIntent: 'never' as const},
      {name: runtimeRequestLedgerSlaveSliceName, persistIntent: 'never' as const},
    ],
    stateSlices: [runtimeInstanceModeSlice, runtimeRequestLedgerMasterSlice, runtimeRequestLedgerSlaveSlice],
  });
};
