import {defineCommand} from '../../foundations/defineCommand'
import {moduleName} from '../../moduleName'

export type InitializePayload = Readonly<{}>

export const initializeCommand = defineCommand<InitializePayload>(moduleName, {
  name: 'initialize',
  visibility: 'internal',
  allowNoActor: true,
  allowReentry: false,
  defaultTarget: 'local',
})
