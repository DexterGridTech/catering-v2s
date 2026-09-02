import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'

type ClearUiVariablesPayload = Readonly<{
  readonly keys: readonly string[]
}>

export const clearUiVariablesCommand = defineCommand<ClearUiVariablesPayload>(moduleName, {
  name: 'clear-ui-variables',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
})
