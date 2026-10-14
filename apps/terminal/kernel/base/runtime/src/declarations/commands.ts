import {defineCommand} from '../foundations/defineCommand';
import {postCommitConsumerTimeoutMs} from './parameters';

import {moduleName} from '../moduleName';

import {type RuntimeInstanceId} from '@catering-v2s/kernel-base-contracts';

import {type RuntimeInstanceMode, type SetRuntimeInstanceModePayload} from '../types/role';

export type PrimarySurfaceReadyPayload = Readonly<{
  contentReady: boolean;
}>;

/** Generic lifecycle fact emitted after the primary surface's startup routing completes. */
export const primarySurfaceReadyCommand = defineCommand<PrimarySurfaceReadyPayload>(moduleName, {
  name: 'primary-surface-ready',
  visibility: 'internal',
  allowNoActor: true,
});

/** Internal maintenance command; it is intentionally not part of the package root exports. */
export type CleanupRequestLedgerPayload = Readonly<{}>;

export const cleanupRequestLedgerCommand = defineCommand<CleanupRequestLedgerPayload>(moduleName, {
  name: 'cleanup-request-ledger',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export type InitializePayload = Readonly<{}>;

export const initializeCommand = defineCommand<InitializePayload>(moduleName, {
  name: 'initialize',
  visibility: 'internal',
  allowNoActor: true,
  allowReentry: false,
  defaultTarget: 'local',
});

export type RecordLocalInteractionPayload = Readonly<{
  runtimeIdentity: RuntimeInstanceId;
}>;

export const recordLocalInteractionCommand = defineCommand<RecordLocalInteractionPayload>(moduleName, {
  name: 'record-local-interaction',
  visibility: 'public',
  defaultTarget: 'local',
});

export type ResetRuntimeAfterSystemFailurePayload = Readonly<{}>;

export const resetRuntimeAfterSystemFailureCommand = defineCommand<ResetRuntimeAfterSystemFailurePayload>(moduleName, {
  name: 'reset-runtime-after-system-failure',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

// Keep post-commit notification bounded below the parent set-mode command's
// default budget. A slow consumer must remain independently observable without
// turning a committed role change into a parent timeout.
type RuntimeInstanceModeChangedPayload = Readonly<{
  previousMode: RuntimeInstanceMode;
  nextMode: RuntimeInstanceMode;
}>;

/** Internal post-commit notification; consumers react through actors. */
export const runtimeInstanceModeChangedCommand = defineCommand<RuntimeInstanceModeChangedPayload>(moduleName, {
  name: 'instance-mode-changed',
  visibility: 'internal',
  timeoutMs: postCommitConsumerTimeoutMs,
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

/** Side-effect-free registered command used to verify the remote command/result path. */
export const helloWorldCommand = defineCommand(moduleName, {
  name: 'hello-world',
  visibility: 'public',
});

export const setRuntimeInstanceModeCommand = defineCommand<SetRuntimeInstanceModePayload>(moduleName, {
  name: 'set-instance-mode',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
