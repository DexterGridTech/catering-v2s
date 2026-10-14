import {
  cleanupRequestLedgerCommand,
  initializeCommand,
  runtimeInstanceModeChangedCommand,
  setRuntimeInstanceModeCommand,
  helloWorldCommand,
  primarySurfaceReadyCommand,
} from '../declarations/commands';
import {runtimeInstanceModeSlice} from '../features/slices/runtimeInstanceMode';
import {runtimeRequestLedgerMasterSlice} from '../features/slices/requestLedgerMaster';
import {runtimeRequestLedgerSlaveSlice} from '../features/slices/requestLedgerSlave';
import {moduleKind, moduleName} from '../moduleName';
import type {RuntimeModule, RuntimeRoleChangeSignal} from '../types/module';
import {createSetRuntimeInstanceModeActor} from '../features/actors/setRuntimeInstanceModeActor';
import {createCleanupRequestLedgerActor} from '../features/actors/cleanupRequestLedgerActor';
import {createRequestLedgerRoleChangedActor} from '../features/actors/requestLedgerRoleChangedActor';
import {createResetRuntimeAfterSystemFailureActor} from '../features/actors/resetRuntimeAfterSystemFailureActor';
import {createHelloWorldActor} from '../features/actors/helloWorldActor';
import {createLocalInteractionActor} from '../features/actors/localInteractionActor';
import {resetRuntimeAfterSystemFailureCommand} from '../declarations/commands';
import {defaultRequestMaxResidenceMs, defaultRequestRetentionMs} from '../declarations/parameters';
import type {RuntimeLimits} from '../types/limits';
import {selectRequestExecutionView} from '../selectors/selectRequestExecutionView';
import {selectRequestExecutionCommands} from '../selectors/selectRequestExecutionCommands';
import {selectRequestExecutionViews} from '../selectors/selectRequestExecutionViews';
import {selectRequestExecutionCandidates} from '../selectors/selectRequestExecutionCandidates';
import {selectRuntimeInstanceMode} from '../selectors/selectRuntimeInstanceMode';
import {selectLastLocalInteraction} from '../selectors/selectLastLocalInteraction';
import {recordLocalInteractionCommand} from '../declarations/commands';
import {localInteractionSlice} from '../features/slices/localInteraction';
import {createRuntimeModule} from './createRuntimeModule';

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

  return createRuntimeModule({
    moduleName,
    kind: moduleKind,
    dependencies: [],
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
    actorDefinitions: [
      actor,
      cleanupActor,
      roleChangedActor,
      resetRuntimeAfterSystemFailureActor,
      helloWorldActor,
      localInteractionActor,
    ],
    stateSlices: [
      runtimeInstanceModeSlice,
      runtimeRequestLedgerMasterSlice,
      runtimeRequestLedgerSlaveSlice,
      localInteractionSlice,
    ],
  });
};
