import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import {createRenderPartDiagnosticReporter} from '../foundations/diagnostics'
import {createRenderSnapshotReader} from '../foundations/createRenderSnapshotReader'
import {RenderContext, type RenderContextValue} from '../contexts/RenderContext'
import type {RenderProviderProps} from '../types/props'

export const RenderProvider = ({
  stateSource,
  uiCatalog,
  rendererCatalog,
  logger,
  dispatchCommand,
  selectUiVariable,
  children,
}: RenderProviderProps) => {
  const snapshotReader = useMemo(() => createRenderSnapshotReader(stateSource), [stateSource])
  const status = useSyncExternalStore(stateSource.subscribe, stateSource.getStatus, stateSource.getStatus)
  const previousStatus = useRef(status)
  useEffect(() => {
    if (previousStatus.current === status) return
    logger.info({
      category: 'ui.base.render',
      event: 'runtime-status-changed',
      data: {previousStatus: previousStatus.current, status},
    })
    previousStatus.current = status
  }, [logger, status])

  const diagnosticReporter = useMemo(() => createRenderPartDiagnosticReporter(logger), [logger])
  const contextValue = useMemo<RenderContextValue>(() => Object.freeze({
    stateSource,
    uiCatalog,
    rendererCatalog,
    logger,
    dispatchCommand,
    selectUiVariable,
    snapshotReader,
    reportPartDiagnostic: diagnosticReporter.report,
    clearPartDiagnostic: diagnosticReporter.clearForPart,
  }), [
    diagnosticReporter.report,
    dispatchCommand,
    logger,
    rendererCatalog,
    selectUiVariable,
    snapshotReader,
    stateSource,
    uiCatalog,
  ])

  return createElement(RenderContext.Provider, {value: contextValue}, children)
}
