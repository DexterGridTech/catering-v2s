import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import {createRenderPartDiagnosticReporter} from '../foundations/diagnostics'
import {createRenderSnapshotReader} from '../foundations/createRenderSnapshotReader'
import {
  RenderContext,
  RenderSubscriptionContext,
  type RenderContextValue,
  type RenderSubscriptionContextValue,
} from '../contexts/RenderContext'
import type {RenderProviderProps, RenderSurfaceReadyInput} from '../types/props'

const emptyLayerDismissals = Object.freeze({})

export const RenderProvider = ({
  stateSource,
  uiCatalog,
  rendererCatalog,
  logger,
  nativeLoadingCapability,
  onPrimarySurfaceReady,
  getPrimarySurfaceReady,
  runtimeFacts,
  onRuntimeRetry,
  topologyCapability,
  dispatchCommand,
  createRouteContext,
  layerDismissals,
  selectUiVariable,
  selectSurfaceForm,
  children,
}: RenderProviderProps) => {
  const selectSurfaceFormReader: NonNullable<RenderProviderProps['selectSurfaceForm']> =
    selectSurfaceForm ?? (() => {
      throw new Error('[ui-base-render] selectSurfaceForm is required when SurfaceRoot is mounted')
    })
  const snapshotReader = useMemo(() => createRenderSnapshotReader(stateSource), [stateSource])
  const status = useSyncExternalStore(stateSource.subscribe, stateSource.getStatus, stateSource.getStatus)
  const [hasPrimarySurfaceReady, setHasPrimarySurfaceReady] = useState(
    () => getPrimarySurfaceReady?.() ?? false,
  )
  const reportPrimarySurfaceReady = useCallback(async (input: RenderSurfaceReadyInput) => {
    await onPrimarySurfaceReady?.(input)
    setHasPrimarySurfaceReady(true)
  }, [onPrimarySurfaceReady])
  const previousStatus = useRef(status)
  const startupReported = useRef(false)
  useEffect(() => {
    if (!__DEV__ || startupReported.current) return
    startupReported.current = true
    const parts = uiCatalog.entries.map(entry => {
      const binding = rendererCatalog.resolve(entry.rendererKey)
      return {
        partKey: entry.partKey,
        rendererKey: entry.rendererKey,
        layerTier: binding?.layerTier ?? null,
        layerGuard: binding?.layerGuard ?? null,
      }
    })
    logger.info({
      category: 'startup.parts',
      event: 'startup.parts',
      message: 'UI parts and renderer bindings registered',
      data: {
        count: parts.length,
        parts,
        missingRendererKeys: [...new Set(parts
          .filter(part => part.layerTier === null)
          .map(part => part.rendererKey))],
      },
    })
  }, [logger, rendererCatalog, uiCatalog])
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
  const subscriptionContextValue = useMemo<RenderSubscriptionContextValue>(() => Object.freeze({
    stateSource,
    snapshotReader,
  }), [snapshotReader, stateSource])
  const contextValue = useMemo<RenderContextValue>(() => Object.freeze({
    uiCatalog,
    rendererCatalog,
    logger,
    nativeLoadingCapability,
    onPrimarySurfaceReady: onPrimarySurfaceReady === undefined ? undefined : reportPrimarySurfaceReady,
    hasPrimarySurfaceReady,
    runtimeFacts,
    onRuntimeRetry,
    topologyCapability,
    dispatchCommand,
    createRouteContext,
    layerDismissals: layerDismissals ?? emptyLayerDismissals,
    selectUiVariable,
    selectSurfaceForm: selectSurfaceFormReader,
    reportPartDiagnostic: diagnosticReporter.report,
    clearPartDiagnostic: diagnosticReporter.clearForPart,
  }), [
    diagnosticReporter.report,
    dispatchCommand,
    createRouteContext,
    layerDismissals,
    logger,
    nativeLoadingCapability,
    onPrimarySurfaceReady,
    reportPrimarySurfaceReady,
    rendererCatalog,
    selectUiVariable,
    selectSurfaceFormReader,
    runtimeFacts,
    onRuntimeRetry,
    topologyCapability,
    uiCatalog,
    hasPrimarySurfaceReady,
  ])

  return (
    <RenderSubscriptionContext.Provider value={subscriptionContextValue}>
      <RenderContext.Provider value={contextValue}>{children}</RenderContext.Provider>
    </RenderSubscriptionContext.Provider>
  )
}
