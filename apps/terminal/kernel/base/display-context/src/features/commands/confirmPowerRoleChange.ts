import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'
import type {DisplayRole, PowerSource} from '../../types/display'

export type ConfirmPowerRoleChangePayload = Readonly<{
  readonly powerSource: PowerSource
  readonly targetRole: DisplayRole
}>

export const confirmPowerRoleChangeCommand = defineCommand<ConfirmPowerRoleChangePayload>(moduleName, {
  name: 'confirm-power-role-change',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
})
