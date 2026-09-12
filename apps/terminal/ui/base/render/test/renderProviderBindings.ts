import type {RenderProviderProps} from '../src/index'
import {createRenderRuntimeFacts, resolveDebugMode} from '../src/index'

const runtimeFacts: RenderProviderProps['runtimeFacts'] = createRenderRuntimeFacts({
  environmentMode: 'TEST',
  debugMode: resolveDebugMode({}),
  deviceIdentity: {available: false, deviceId: null},
  platformPortCapabilities: [],
})

const dispatchCommand: RenderProviderProps['dispatchCommand'] = async () => {
  throw new Error('render test dispatch binding was not expected to run')
}

const selectUiVariable: RenderProviderProps['selectUiVariable'] = (_root, declaration) =>
  declaration.defaultValue

const selectSurfaceForm: RenderProviderProps['selectSurfaceForm'] = () => 'laptop'

export const unusedRenderProviderBindings = Object.freeze({
  dispatchCommand,
  selectUiVariable,
  selectSurfaceForm,
  runtimeFacts,
})
