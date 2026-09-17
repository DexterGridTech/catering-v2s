import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'

export type CancelPowerRoleChangePayload = Readonly<{}>

export const cancelPowerRoleChangeCommand = defineCommand<CancelPowerRoleChangePayload>(moduleName, {
  name: 'cancel-power-role-change',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
})
