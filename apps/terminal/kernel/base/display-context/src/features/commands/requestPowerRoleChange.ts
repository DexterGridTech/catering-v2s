import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'
import type {PowerSource} from '../../types/display'

export type RequestPowerRoleChangePayload = Readonly<{readonly powerSource: PowerSource}>

export const requestPowerRoleChangeCommand = defineCommand<RequestPowerRoleChangePayload>(moduleName, {
  name: 'request-power-role-change',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
})
