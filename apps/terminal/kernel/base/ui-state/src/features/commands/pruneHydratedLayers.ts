import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'

type PruneHydratedLayersPayload = Readonly<Record<string, never>>

/** Install-only reconciliation of hydrated layer membership against the module catalog. */
export const pruneHydratedLayersCommand = defineCommand<PruneHydratedLayersPayload>(moduleName, {
  name: 'prune-hydrated-layers',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
})
