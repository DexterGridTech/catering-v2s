import {useMemo} from 'react'
import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector'
import {useRenderSubscriptionContext} from '../contexts/RenderContext'
import type {RenderSnapshot} from '../foundations/createRenderSnapshotReader'
import type {RenderProviderProps} from '../types/props'

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>
type SelectedValue<TValue> = TValue | undefined

export type UiStateSelectorEquality<TValue> = (
  previous: SelectedValue<TValue>,
  next: SelectedValue<TValue>,
) => boolean

/**
 * Reads one UI projection from the framework-owned render subscription.
 * When the runtime snapshot is unavailable, this returns `undefined` without
 * invoking the selector. Once a root is available, a selector may also
 * legitimately return `undefined`; consumers that need to distinguish those
 * cases must also read `useRenderStatus`.
 */
export const useUiStateSelector = <TValue>(
  selector: (root: RuntimeStateRoot) => TValue,
  equalityFn?: UiStateSelectorEquality<TValue>,
): SelectedValue<TValue> => {
  const {stateSource, snapshotReader} = useRenderSubscriptionContext()
  const selectSnapshot = useMemo(
    () => (snapshot: RenderSnapshot): SelectedValue<TValue> => snapshot.root === undefined
      ? undefined
      : selector(snapshot.root),
    [selector],
  )
  return useSyncExternalStoreWithSelector(
    stateSource.subscribe,
    snapshotReader.getSnapshot,
    snapshotReader.getSnapshot,
    selectSnapshot,
    equalityFn,
  )
}
