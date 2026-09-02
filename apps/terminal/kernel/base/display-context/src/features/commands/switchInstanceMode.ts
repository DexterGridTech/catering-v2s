import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'
import type {RuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'

type SwitchInstanceModePayload = Readonly<{instanceMode: RuntimeInstanceMode}>

export const switchInstanceModeCommand = defineCommand<SwitchInstanceModePayload>(moduleName, {
  name: 'switch-instance-mode',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
})
