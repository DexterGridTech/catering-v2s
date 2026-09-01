import {
  defineStateRuntimeSlice,
  type StateRuntimeSliceRegistration,
} from '@catering-v2s/kernel-base-state'
import {isRuntimeInstanceMode, type RuntimeInstanceMode} from '../../types/role'
import type {RuntimeUnknownAction} from '../../types/runtime'

export type RuntimeInstanceModeState = Readonly<{
  instanceMode: RuntimeInstanceMode
}>

const setRuntimeInstanceModeActionType = '@@catering-v2s/runtime/SET_INSTANCE_MODE'
export const runtimeInstanceModeSliceName = 'kernel.base.runtime.instance-mode' as const

export const createSetRuntimeInstanceModeAction = (
  instanceMode: RuntimeInstanceMode,
): RuntimeUnknownAction & {readonly payload: RuntimeInstanceMode} => ({
  type: setRuntimeInstanceModeActionType,
  payload: instanceMode,
})

const reducer = (
  state: RuntimeInstanceModeState = {instanceMode: 'MASTER'},
  action: RuntimeUnknownAction,
): RuntimeInstanceModeState => {
  if (action.type !== setRuntimeInstanceModeActionType) return state
  const payload = Reflect.get(action, 'payload')
  return isRuntimeInstanceMode(payload)
    ? {instanceMode: payload}
    : state
}

export const runtimeInstanceModeSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice({
  name: runtimeInstanceModeSliceName,
  reducer,
  persistIntent: 'owner-only',
  persistence: [
    {
      kind: 'field',
      stateKey: 'instanceMode',
      protection: 'plain',
      flushMode: 'immediate',
    },
  ],
  syncIntent: 'isolated',
})
