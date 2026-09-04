import {useRef} from 'react'
import type {RenderProviderProps} from '../types/props'
import {useRenderSnapshot} from './useRenderSnapshot'

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>

type SelectorCache<TValue> = Readonly<{
  readonly root: RuntimeStateRoot
  readonly selector: (root: RuntimeStateRoot) => TValue
  readonly result: TValue
}>

export const useUiStateSelector = <TValue>(
  selector: (root: RuntimeStateRoot) => TValue,
): TValue | undefined => {
  const snapshot = useRenderSnapshot()
  const cache = useRef<SelectorCache<TValue> | undefined>(undefined)
  if (snapshot.root === undefined) return undefined
  if (cache.current?.root === snapshot.root && cache.current.selector === selector) {
    return cache.current.result
  }
  const result = selector(snapshot.root)
  cache.current = Object.freeze({root: snapshot.root, selector, result})
  return result
}
