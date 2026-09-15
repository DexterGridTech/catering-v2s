import type {RenderProviderProps} from '../src/index'
import {createRenderRuntimeFacts, resolveDebugMode} from '../src/index'
import type {NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports'

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

export const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
})

export const unusedRenderProviderBindings = Object.freeze({
  dispatchCommand,
  selectUiVariable,
  selectSurfaceForm,
  runtimeFacts,
  nativeLoadingCapability,
})
