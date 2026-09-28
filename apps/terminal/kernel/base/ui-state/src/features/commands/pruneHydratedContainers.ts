import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

type PruneHydratedContainersPayload = Readonly<Record<string, never>>;

/** Install-only reconciliation of hydrated screen containers against the module catalog. */
export const pruneHydratedContainersCommand = defineCommand<PruneHydratedContainersPayload>(moduleName, {
  name: 'prune-hydrated-containers',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
