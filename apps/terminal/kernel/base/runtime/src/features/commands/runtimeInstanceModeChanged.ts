import {defineCommand} from '../../foundations/defineCommand';
import {moduleName} from '../../moduleName';
import type {RuntimeInstanceMode} from '../../types/role';

// Keep post-commit notification bounded below the parent set-mode command's
// default budget. A slow consumer must remain independently observable without
// turning a committed role change into a parent timeout.
const postCommitConsumerTimeoutMs = 5_000;

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
