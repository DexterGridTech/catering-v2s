import type {RuntimeInstanceId} from '@catering-v2s/kernel-base-contracts';
import {defineCommand} from '../../foundations/defineCommand';
import {moduleName} from '../../moduleName';

export type RecordLocalInteractionPayload = Readonly<{runtimeIdentity: RuntimeInstanceId}>;

export const recordLocalInteractionCommand = defineCommand<RecordLocalInteractionPayload>(moduleName, {
  name: 'record-local-interaction',
  visibility: 'public',
  defaultTarget: 'local',
});
