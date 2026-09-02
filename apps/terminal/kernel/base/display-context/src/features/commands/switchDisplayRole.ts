import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'
import type {DisplayRole} from '../../types/display'

type SwitchDisplayRolePayload = Readonly<{displayRole: DisplayRole}>

export const switchDisplayRoleCommand = defineCommand<SwitchDisplayRolePayload>(moduleName, {
  name: 'switch-display-role',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
})
