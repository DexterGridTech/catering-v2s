import {useSyncExternalStore} from 'react'
import {useRenderContext} from '../contexts/RenderContext'
import type {RenderSnapshot} from '../foundations/createRenderSnapshotReader'

export const useRenderSnapshot = (): RenderSnapshot => {
  const {stateSource, snapshotReader} = useRenderContext()
  return useSyncExternalStore(
    stateSource.subscribe,
    snapshotReader.getSnapshot,
    snapshotReader.getSnapshot,
  )
}
