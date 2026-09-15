import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react'
import {StyleSheet, Text, View, type LayoutChangeEvent} from 'react-native'
import type {LoggerPort, NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports'
import {useRenderContext} from '../contexts/RenderContext'
import {useSurfaceContext} from '../contexts/SurfaceContext'
import type {RenderSurfaceReadyInput} from '../types/props'
import type {RenderFallbackReason} from './resolvePart'

const STARTUP_FAILURE_TEST_ID = 'ui.base.render:startup-failure'
const RUNTIME_FAILURE_TEST_ID = 'ui.base.render:runtime-failure'
const FAILURE_MESSAGE = '请重启终端，如仍失败请联系管理员'
const FAILURE_TITLES = Object.freeze({
  startup: '终端启动失败',
  runtime: '终端运行异常',
})

export type FailureStage = keyof typeof FAILURE_TITLES

type TargetSurfaceState = Readonly<{
  readonly matches: boolean
  readonly reason: 'target' | 'missing-identity' | 'identity-mismatch'
}>

const targetSurfaceState = (
  surface: ReturnType<typeof useSurfaceContext>,
  capability: ReturnType<typeof useRenderContext>['nativeLoadingCapability'],
): TargetSurfaceState => {
  const identity = surface.surfaceIdentity
  if (identity === null) return {matches: false, reason: 'missing-identity'}
  const target = capability.targetPhysicalSurface
  const unavailablePrimary = surface.surfaceHostAvailability === 'unavailable'
    && identity.surfaceKey === 'PRIMARY'
    && identity.displayIndex === 0
  const matches = identity.surfaceKey === target.surfaceKey
    && identity.displayIndex === target.displayIndex
    && (surface.isHostPrimaryDisplay || unavailablePrimary)
  return {matches, reason: matches ? 'target' : 'identity-mismatch'}
}

const positiveLayout = (event: LayoutChangeEvent): Readonly<{readonly width: number; readonly height: number}> | null => {
  const {width, height} = event.nativeEvent.layout
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? {width, height}
    : null
}

const readErrorName = (error: unknown): string => error instanceof Error ? error.name : 'UnknownError'

export type StartupFailurePageProps = Readonly<{
  readonly reason: string
  readonly failureStage?: FailureStage
  readonly errorName?: string
  readonly fallbackReason?: RenderFallbackReason
}>

export type StandaloneStartupFailurePageProps = Readonly<{
  readonly reason: string
  readonly displayIndex: 0 | 1
  readonly logger: LoggerPort
  readonly nativeLoadingCapability: NativeLoadingCapability
}>

const safeFailureToken = (value: string): string => value
  .replace(/[^A-Za-z0-9_.:-]/g, '_')
  .slice(0, 80)

const failureCode = (reason: string, errorName: string | undefined): string => [
  safeFailureToken(reason),
  safeFailureToken(errorName ?? 'UnknownError'),
].join(':')

const StartupFailurePageView = ({
  failureStage,
  reason,
  errorName,
}: Readonly<{
  readonly failureStage: FailureStage
  readonly reason: string
  readonly errorName?: string
}>) => {
  const testId = failureStage === 'startup' ? STARTUP_FAILURE_TEST_ID : RUNTIME_FAILURE_TEST_ID
  const title = FAILURE_TITLES[failureStage]
  const code = failureCode(reason, errorName)
  return (
    <View
      testID={testId}
      style={styles.failure}
      accessibilityRole="alert"
      accessibilityLabel={`${title}，${FAILURE_MESSAGE}`}
    >
      <Text testID={`${testId}:title`}>{title}</Text>
      <Text testID={`${testId}:message`} accessibilityRole="alert">
        {FAILURE_MESSAGE}
      </Text>
      <Text testID={`${testId}:code`}>{code}</Text>
    </View>
  )
}

/**
 * The failure page is deliberately render-owned. It never fabricates a
 * business part and it only asks the physical PRIMARY splash owner to hide.
 */
export const StartupFailurePage = ({reason, failureStage = 'startup', errorName, fallbackReason}: StartupFailurePageProps) => {
  const {logger, nativeLoadingCapability} = useRenderContext()
  const surface = useSurfaceContext()
  const attempted = useRef(false)
  const target = targetSurfaceState(surface, nativeLoadingCapability)

  useEffect(() => {
    if (attempted.current || !target.matches) return
    attempted.current = true
    void nativeLoadingCapability.hideOnce('startup-failure').then(result => {
      logger.error({
        category: 'startup.failure-page',
        event: 'startup.failure-page-visible',
        message: FAILURE_MESSAGE,
        data: {
          reason,
          failureStage,
          errorName: errorName ?? 'UnknownError',
          errorCode: failureCode(reason, errorName),
          fallbackReason: fallbackReason ?? null,
          hideResult: result.alreadyHidden ? 'already-hidden' : 'hidden',
          surfaceKey: surface.surfaceIdentity?.surfaceKey ?? null,
          displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
        },
      })
    }).catch(error => {
      logger.error({
        category: 'startup.failure-page',
        event: 'startup.failure-page-hide-failed',
        message: 'Startup failure page could not hide native loading',
        data: {
          reason,
          failureStage,
          fallbackReason: fallbackReason ?? null,
          errorName: readErrorName(error),
          errorCode: failureCode(reason, readErrorName(error)),
        },
      })
    })
  }, [errorName, failureStage, fallbackReason, logger, nativeLoadingCapability, reason, surface.surfaceIdentity, target.matches])

  return <StartupFailurePageView failureStage={failureStage} reason={reason} errorName={errorName} />
}

/**
 * The assembly-rejection path happens before RenderProvider and SurfaceRoot
 * exist. It still uses the render-owned failure page and the same physical
 * PRIMARY splash rule, with the App shell supplying only the pre-render facts.
 */
export const StandaloneStartupFailurePage = ({
  reason,
  displayIndex,
  logger,
  nativeLoadingCapability,
}: StandaloneStartupFailurePageProps) => {
  const attempted = useRef(false)
  const isTarget = displayIndex === nativeLoadingCapability.targetPhysicalSurface.displayIndex

  useEffect(() => {
    if (attempted.current || !isTarget) return
    attempted.current = true
    void nativeLoadingCapability.hideOnce('startup-failure').then(result => {
      logger.error({
        category: 'startup.failure-page',
        event: 'startup.failure-page-visible',
        message: FAILURE_MESSAGE,
        data: {
          reason,
          errorName: 'UnknownError',
          errorCode: failureCode(reason, 'UnknownError'),
          fallbackReason: 'assembly-rejection',
          hideResult: result.alreadyHidden ? 'already-hidden' : 'hidden',
          surfaceKey: 'PRIMARY',
          displayIndex,
          source: 'ui.base.render.StandaloneStartupFailurePage',
        },
      })
    }).catch(error => {
      logger.error({
        category: 'startup.failure-page',
        event: 'startup.failure-page-hide-failed',
        message: 'Startup failure page could not hide native loading',
        data: {
          reason,
          errorName: readErrorName(error),
          errorCode: failureCode(reason, readErrorName(error)),
          fallbackReason: 'assembly-rejection',
          surfaceKey: 'PRIMARY',
          displayIndex,
          source: 'ui.base.render.StandaloneStartupFailurePage',
        },
      })
    })
  }, [displayIndex, isTarget, logger, nativeLoadingCapability, reason])

  return <StartupFailurePageView failureStage="startup" reason={reason} />
}

export type ScreenReadyBoundaryProps = Readonly<{
  readonly partKey: string
  readonly children?: ReactNode
}>

/**
 * Readiness is emitted only from the resolved real-part layout. Root mount,
 * host spinner, logical display mode, and every fallback branch are excluded.
 */
export const ScreenReadyBoundary = ({partKey, children}: ScreenReadyBoundaryProps) => {
  const {
    logger,
    nativeLoadingCapability,
    onPrimarySurfaceReady,
    hasPrimarySurfaceReady,
  } = useRenderContext()
  const surface = useSurfaceContext()
  const layoutRef = useRef<Readonly<{readonly width: number; readonly height: number}> | null>(null)
  const attempted = useRef(false)
  const [failure, setFailure] = useState<string | null>(null)
  const target = targetSurfaceState(surface, nativeLoadingCapability)

  const tryReportReady = useCallback(() => {
    if (attempted.current || hasPrimarySurfaceReady || !target.matches || surface.hostLogicalSize === null || layoutRef.current === null) return
    attempted.current = true
    const readyInput: RenderSurfaceReadyInput = {
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      displayMode: surface.displayMode,
      containerKey: surface.containerKey,
      partKey,
    }
    logger.info({
      category: 'startup.ready-candidate',
      event: 'startup.ready-candidate',
      message: 'Resolved PRIMARY screen part completed its first layout',
      data: {
        surfaceKey: readyInput.surfaceKey,
        displayIndex: readyInput.displayIndex,
        displayMode: readyInput.displayMode,
        containerKey: readyInput.containerKey,
        partKey,
        layoutWidth: layoutRef.current.width,
        layoutHeight: layoutRef.current.height,
        hostWidth: surface.hostLogicalSize.width,
        hostHeight: surface.hostLogicalSize.height,
        source: 'ui-base-render.ScreenReadyBoundary',
      },
    })
    void Promise.resolve()
      .then(() => onPrimarySurfaceReady?.(readyInput))
      .then(() => nativeLoadingCapability.hideOnce('startup-ready'))
      .then(result => {
        if (!result.hidden && !result.alreadyHidden) {
          throw new Error('native loading hide returned no state change')
        }
        return result
      })
      .then(() => {
        logger.info({
          category: 'startup.ready-hidden',
          event: 'startup.ready-hidden',
          message: 'Native loading hidden after resolved PRIMARY screen layout',
          data: {
            surfaceKey: readyInput.surfaceKey,
            displayIndex: readyInput.displayIndex,
            displayMode: readyInput.displayMode,
            partKey,
            source: 'ui-base-render.ScreenReadyBoundary',
          },
        })
      })
      .catch(error => {
        logger.error({
          category: 'startup.failure-page',
          event: 'startup.ready-failed',
          message: 'Resolved PRIMARY screen could not complete startup readiness',
          data: {partKey, errorName: readErrorName(error)},
        })
        setFailure(readErrorName(error))
      })
  }, [hasPrimarySurfaceReady, logger, nativeLoadingCapability, onPrimarySurfaceReady, partKey, surface.containerKey, surface.displayMode, surface.hostLogicalSize, target.matches])

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const layout = positiveLayout(event)
    if (layout === null) return
    layoutRef.current = layout
    tryReportReady()
  }, [tryReportReady])

  useEffect(() => {
    tryReportReady()
  }, [tryReportReady])

  if (failure !== null) {
    return (
      <StartupFailurePage
        reason="ready-callback-failed"
        errorName={failure}
        failureStage={hasPrimarySurfaceReady ? 'runtime' : 'startup'}
      />
    )
  }

  return (
    <View testID="ui-base-render:screen-ready-boundary" style={styles.content} onLayout={onLayout}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  failure: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
})
