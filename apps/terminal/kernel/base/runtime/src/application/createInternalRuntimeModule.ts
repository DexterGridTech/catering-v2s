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
import {createLocalInteractionActor} from '../features/actors/localInteractionActor';
import {resetRuntimeAfterSystemFailureCommand} from '../features/commands/resetRuntimeAfterSystemFailure';
import {defaultRequestMaxResidenceMs, defaultRequestRetentionMs, type RuntimeLimits} from '../types/limits';
import {selectRequestExecutionView} from '../selectors/selectRequestExecutionView';
import {selectRequestExecutionCommands, selectRequestExecutionViews} from '../selectors/selectRequestExecutionViews';
import {selectRequestExecutionCandidates} from '../selectors/selectRequestExecutionCandidates';
import {selectRuntimeInstanceMode} from '../selectors/selectRuntimeInstanceMode';
import {selectLastLocalInteraction} from '../selectors/selectLastLocalInteraction';
import {recordLocalInteractionCommand} from '../features/commands/recordLocalInteraction';
import {localInteractionSlice, localInteractionSliceName} from '../features/slices/localInteraction';

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
  const localInteractionActor = createLocalInteractionActor();

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
      {name: recordLocalInteractionCommand.commandName, visibility: 'public' as const},
      {name: resetRuntimeAfterSystemFailureCommand.commandName, visibility: 'public' as const},
      {name: helloWorldCommand.commandName, visibility: 'public' as const},
    ],
    commandDefinitions: [
      initializeCommand,
      setRuntimeInstanceModeCommand,
      cleanupRequestLedgerCommand,
      runtimeInstanceModeChangedCommand,
      primarySurfaceReadyCommand,
      recordLocalInteractionCommand,
      resetRuntimeAfterSystemFailureCommand,
      helloWorldCommand,
    ],
    selectorDefinitions: [
      selectRequestExecutionView,
      selectRequestExecutionViews,
      selectRequestExecutionCommands,
      selectRequestExecutionCandidates,
      selectRuntimeInstanceMode,
      selectLastLocalInteraction,
    ],
    actors: [
      {name: 'instance-mode'},
      {name: 'request-ledger-cleanup'},
      {name: 'request-ledger-role-changed'},
      {name: 'reset-runtime-after-system-failure'},
      {name: 'hello-world'},
      {name: 'local-interaction'},
    ],
    actorDefinitions: [
      actor,
      cleanupActor,
      roleChangedActor,
      resetRuntimeAfterSystemFailureActor,
      helloWorldActor,
      localInteractionActor,
    ],
    slices: [
      {name: runtimeInstanceModeSliceName, persistIntent: 'owner-only' as const},
      {name: runtimeRequestLedgerMasterSliceName, persistIntent: 'never' as const},
      {name: runtimeRequestLedgerSlaveSliceName, persistIntent: 'never' as const},
      {name: localInteractionSliceName, persistIntent: 'never' as const},
    ],
    stateSlices: [runtimeInstanceModeSlice, runtimeRequestLedgerMasterSlice, runtimeRequestLedgerSlaveSlice, localInteractionSlice],
  });
};
