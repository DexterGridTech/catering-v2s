import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {UiVariableDeclaration} from '@catering-v2s/kernel-base-ui-state'
import type {RenderProviderProps} from '../types/props'
import {useRenderContext} from '../contexts/RenderContext'
import {useRenderSnapshot} from './useRenderSnapshot'

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>

export const useUiVariable = <TValue extends StateJsonValue>(
  declaration: UiVariableDeclaration<TValue>,
): TValue | undefined => {
  const {selectUiVariable} = useRenderContext()
  const snapshot = useRenderSnapshot()
  if (snapshot.root === undefined) return undefined
  return selectUiVariable(snapshot.root as RuntimeStateRoot, declaration)
}
