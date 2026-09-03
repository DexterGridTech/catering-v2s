import {useRef} from 'react'
import type {Runtime} from '@catering-v2s/kernel-base-runtime'
import {useRenderSnapshot} from './useRenderSnapshot'

type RuntimeStateRoot = ReturnType<Runtime['getState']>

type SelectorCache<TValue> = Readonly<{
  readonly root: RuntimeStateRoot
  readonly result: TValue
}>

export const useUiStateSelector = <TValue>(
  selector: (root: RuntimeStateRoot) => TValue,
): TValue | undefined => {
  const snapshot = useRenderSnapshot()
  const cache = useRef<SelectorCache<TValue> | undefined>(undefined)
  if (snapshot.root === undefined) return undefined
  if (cache.current?.root === snapshot.root) return cache.current.result
  const result = selector(snapshot.root)
  cache.current = Object.freeze({root: snapshot.root, result})
  return result
}
