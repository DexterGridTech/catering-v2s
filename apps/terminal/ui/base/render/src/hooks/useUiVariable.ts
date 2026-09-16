import {useMemo} from 'react'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {UiVariableDeclaration} from '@catering-v2s/kernel-base-ui-state'
import {useRenderContext} from '../contexts/RenderContext'
import {useUiStateSelector} from './useUiStateSelector'
import type {RenderProviderProps} from '../types/props'

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>

export const useUiVariable = <TValue extends StateJsonValue>(
  declaration: UiVariableDeclaration<TValue>,
): TValue | undefined => {
  const {selectUiVariable} = useRenderContext()
  const selector = useMemo(
    () => (root: RuntimeStateRoot) => selectUiVariable(root, declaration),
    [declaration, selectUiVariable],
  )
  return useUiStateSelector(selector)
}
