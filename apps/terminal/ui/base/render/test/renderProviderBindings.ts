import type {RenderProviderProps} from '../src/index'

const dispatchCommand: RenderProviderProps['dispatchCommand'] = async () => {
  throw new Error('render test dispatch binding was not expected to run')
}

const selectUiVariable: RenderProviderProps['selectUiVariable'] = (_root, declaration) =>
  declaration.defaultValue

export const unusedRenderProviderBindings = Object.freeze({
  dispatchCommand,
  selectUiVariable,
})
