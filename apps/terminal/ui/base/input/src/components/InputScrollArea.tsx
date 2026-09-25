import {useCallback, useLayoutEffect, useRef, type ReactNode} from 'react'
import type {LayoutChangeEvent} from 'react-native'
import {
  PrimitiveScrollView,
  type PrimitiveInputHandle,
  type PrimitiveScrollViewHandle,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollAncestorContext} from '../contexts/context'
import {useInputSurfaceGeometry} from '../contexts/InputSurfaceGeometryContext'
import {
  calculateScrollOffset,
  INPUT_SCROLL_VISIBILITY_TOLERANCE,
  isRectInsideVisibleVerticalIntersection,
  visibleVerticalIntersectionOf,
  type LayoutRect,
} from '../foundations/scrollIntoView'

export type InputScrollAreaProps = Readonly<{
  readonly testID: string
  readonly children?: ReactNode
  readonly contentPaddingBottom?: number
}>

type ScrollReadback = Readonly<{
  readonly fieldId: string
  readonly contentFieldRect: LayoutRect
  readonly viewportRect: LayoutRect
  readonly surfaceHeight: number
  readonly keyboardHeight: number
  readonly presentationOffsetY: number
  readonly requestedOffset: number
}>

type ScrollReadbackMeasurement = readonly [number, number, number, number]
type ScrollFieldMeasurement = readonly [number, number, number, number]

type ScrollMeasurementInput = Readonly<{
  readonly viewportRect: LayoutRect
  readonly contentFieldRect: LayoutRect
}>

const layoutRectOf = (measurement: ScrollReadbackMeasurement | ScrollFieldMeasurement): LayoutRect | null => {
  const [x, y, width, height] = measurement
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return {x, y, width, height}
}

// This is one request-scoped escape hatch for platforms that do not emit a
// terminal scroll event. It is not the keyboard animation clock and never
// drives a per-frame update.
const SCROLL_READBACK_SETTLE_TIMEOUT_MS = 1_500

export const InputScrollArea = ({testID, children, contentPaddingBottom}: InputScrollAreaProps) => {
  const scrollRef = useRef<PrimitiveScrollViewHandle | null>(null)
  const currentOffsetRef = useRef(0)
  const viewportSizeRef = useRef<Readonly<{readonly width: number; readonly height: number}> | null>(null)
  const contentHeightRef = useRef<number | null>(null)
  const requestSerialRef = useRef(0)
  const readbackRef = useRef<ScrollReadback | null>(null)
  const readbackWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const geometry = useInputSurfaceGeometry()
  const clearReadback = useCallback(() => {
    if (readbackWatchdogRef.current !== null) {
      clearTimeout(readbackWatchdogRef.current)
      readbackWatchdogRef.current = null
    }
    readbackRef.current = null
  }, [])
  const evaluateReadback = useCallback((pending: ScrollReadback, nextOffset: number, failureReason: string | null): boolean => {
    const fieldRect: LayoutRect = {
      x: pending.viewportRect.x + pending.contentFieldRect.x,
      y: pending.viewportRect.y + pending.contentFieldRect.y - nextOffset + pending.presentationOffsetY,
      width: pending.contentFieldRect.width,
      height: pending.contentFieldRect.height,
    }
    const intersection = visibleVerticalIntersectionOf({
      viewportRect: pending.viewportRect,
      surfaceHeight: pending.surfaceHeight,
      keyboardHeight: pending.keyboardHeight,
      presentationOffsetY: pending.presentationOffsetY,
    })
    const fullyVisible = isRectInsideVisibleVerticalIntersection(fieldRect, intersection)
    const targetReached = Math.abs(nextOffset - pending.requestedOffset) <= INPUT_SCROLL_VISIBILITY_TOLERANCE
    if (!fullyVisible && failureReason === null && !targetReached) return false
    clearReadback()
    if (fullyVisible) geometry?.reportFocusVisibilitySuccess(pending.fieldId)
    else geometry?.reportFocusVisibilityFailure(pending.fieldId, failureReason ?? 'scroll-clamped-before-visible')
    return true
  }, [clearReadback, geometry?.reportFocusVisibilityFailure, geometry?.reportFocusVisibilitySuccess])
  const settleReadback = useCallback((fieldId: string, failureReason: string) => {
    const pending = readbackRef.current
    if (pending === null || pending.fieldId !== fieldId) return
    geometry?.cancelScheduledScroll(fieldId)
    evaluateReadback(pending, currentOffsetRef.current, failureReason)
  }, [evaluateReadback, geometry?.cancelScheduledScroll])
  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const {x, y, width, height} = event.nativeEvent.layout
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
    const previous = viewportSizeRef.current
    if (previous === null || previous.width !== width || previous.height !== height) {
      requestSerialRef.current += 1
      viewportSizeRef.current = {width, height}
    }
  }, [])

  const onContentHeightChange = useCallback((height: number) => {
    if (!Number.isFinite(height) || height < 0) return
    const previous = contentHeightRef.current
    if (previous === null || Math.abs(previous - height) > 0.5) {
      requestSerialRef.current += 1
      contentHeightRef.current = height
    }
  }, [])

  const ensureVisible = useCallback((
    fieldId: string,
    inputRef: Readonly<{readonly current: PrimitiveInputHandle | null}> | null,
    requestedKeyboardHeight: number,
  ) => {
    const requestSerial = ++requestSerialRef.current
    geometry?.cancelScheduledScroll(fieldId)
    clearReadback()
    const input = inputRef?.current ?? null
    const scroll = scrollRef.current
    const viewportSize = viewportSizeRef.current
    const contentHeight = contentHeightRef.current
    const surfaceRoot = geometry?.surfaceRoot ?? null
    const contentNode = scroll?.getContentNativeNode() ?? null
    if (
      input === null
      || scroll === null
      || viewportSize === null
      || contentHeight === null
      || surfaceRoot === null
      || geometry === null
      || geometry.surfaceHeight <= 0
    ) {
      geometry?.reportFocusVisibilityFailure(fieldId, 'scroll-geometry-unavailable')
      return
    }
    if (contentNode === null) {
      geometry.reportFocusVisibilityFailure(fieldId, 'scroll-content-node-unavailable')
      return
    }

    let viewportRect: LayoutRect | null = null
    let contentFieldRect: LayoutRect | null = null
    const applyMeasurement = ({viewportRect: measuredViewportRect, contentFieldRect: measuredContentFieldRect}: ScrollMeasurementInput) => {
      if (requestSerialRef.current !== requestSerial) return
      viewportRect = measuredViewportRect
      contentFieldRect = measuredContentFieldRect
      const currentOffset = currentOffsetRef.current
      const fieldRect: LayoutRect = {
        x: measuredViewportRect.x + measuredContentFieldRect.x,
        y: measuredViewportRect.y + measuredContentFieldRect.y - currentOffset,
        width: measuredContentFieldRect.width,
        height: measuredContentFieldRect.height,
      }
      const presentationOffsetY = geometry.presentFocusRect(fieldId, fieldRect)
      const keyboardHeight = geometry.keyboardHeight > 0 ? geometry.keyboardHeight : requestedKeyboardHeight
      const maxScroll = Math.max(0, contentHeight - viewportSize.height)
      const nextOffset = calculateScrollOffset({
        inputRect: fieldRect,
        viewportRect: measuredViewportRect,
        currentOffset,
        maxScroll,
        surfaceHeight: geometry.surfaceHeight,
        keyboardHeight,
        presentationOffsetY,
      })
      const intersection = visibleVerticalIntersectionOf({
        viewportRect: measuredViewportRect,
        surfaceHeight: geometry.surfaceHeight,
        keyboardHeight,
        presentationOffsetY,
      })
      const finalFieldRect: LayoutRect = {
        ...fieldRect,
        y: fieldRect.y - (nextOffset - currentOffset) + presentationOffsetY,
      }
      const visibleAtRequestedOffset = isRectInsideVisibleVerticalIntersection(finalFieldRect, intersection)
      readbackRef.current = {
        fieldId,
        contentFieldRect: measuredContentFieldRect,
        viewportRect: measuredViewportRect,
        surfaceHeight: geometry.surfaceHeight,
        keyboardHeight,
        presentationOffsetY,
        requestedOffset: nextOffset,
      }
      if (nextOffset === currentOffset) {
        clearReadback()
        if (visibleAtRequestedOffset) geometry.reportFocusVisibilitySuccess(fieldId)
        else geometry.reportFocusVisibilityFailure(fieldId, 'scroll-range-insufficient')
        return
      }
      geometry.scheduleScrollAtPresentationStart(fieldId, () => {
        if (requestSerialRef.current !== requestSerial) return
        scroll.scrollTo({y: nextOffset, animated: true})
      })
      readbackWatchdogRef.current = setTimeout(() => {
        if (readbackRef.current?.fieldId !== fieldId) return
        settleReadback(fieldId, 'scroll-readback-timeout')
      }, SCROLL_READBACK_SETTLE_TIMEOUT_MS)
    }

    scroll.measureLayout(
      surfaceRoot,
      (...measurement: ScrollReadbackMeasurement) => {
        const measured = layoutRectOf(measurement)
        if (measured === null) {
          geometry.reportFocusVisibilityFailure(fieldId, 'invalid-scroll-viewport-rectangle')
          return
        }
        viewportRect = measured
        if (contentFieldRect !== null) applyMeasurement({viewportRect: measured, contentFieldRect})
      },
      () => {
        geometry.reportFocusVisibilityFailure(fieldId, 'scroll-viewport-measurement-failed')
      },
    )
    input.measureLayout(
      contentNode,
      (...measurement: ScrollFieldMeasurement) => {
        const measured = layoutRectOf(measurement)
        if (measured === null) {
          geometry.reportFocusVisibilityFailure(fieldId, 'invalid-scroll-field-rectangle')
          return
        }
        contentFieldRect = measured
        if (viewportRect !== null) applyMeasurement({viewportRect, contentFieldRect: measured})
      },
      () => {
        geometry.reportFocusVisibilityFailure(fieldId, 'scroll-field-measurement-failed')
      },
    )
  }, [
    geometry?.keyboardHeight,
    geometry?.cancelScheduledScroll,
    clearReadback,
    geometry?.presentFocusRect,
    geometry?.reportFocusVisibilityFailure,
    geometry?.surfaceHeight,
    geometry?.surfaceRoot,
    geometry?.scheduleScrollAtPresentationStart,
    settleReadback,
  ])

  const onScrollOffsetChange = useCallback((offsetY: number) => {
    const nextOffset = Math.max(0, offsetY)
    currentOffsetRef.current = nextOffset
    const pending = readbackRef.current
    if (pending !== null) {
      const targetReached = Math.abs(nextOffset - pending.requestedOffset) <= INPUT_SCROLL_VISIBILITY_TOLERANCE
      evaluateReadback(pending, nextOffset, targetReached ? 'scroll-clamped-before-visible' : null)
    }
  }, [evaluateReadback])

  const onScrollEndDrag = useCallback((offsetY: number, velocityY: number | null) => {
    onScrollOffsetChange(offsetY)
    if (velocityY !== null && Math.abs(velocityY) > INPUT_SCROLL_VISIBILITY_TOLERANCE) return
    const pending = readbackRef.current
    if (pending !== null) settleReadback(pending.fieldId, 'scroll-ended-before-visible')
  }, [onScrollOffsetChange, settleReadback])

  const onMomentumScrollEnd = useCallback((offsetY: number) => {
    onScrollOffsetChange(offsetY)
    const pending = readbackRef.current
    if (pending !== null) settleReadback(pending.fieldId, 'scroll-ended-before-visible')
  }, [onScrollOffsetChange, settleReadback])

  useLayoutEffect(() => () => {
    clearReadback()
  }, [clearReadback])

  const value = useCallback((
    fieldId: string,
    inputRef: Readonly<{readonly current: PrimitiveInputHandle | null}> | null,
    keyboardHeight: number,
  ) => {
    ensureVisible(fieldId, inputRef, keyboardHeight)
  }, [ensureVisible])

  return (
    <InputScrollAncestorContext.Provider value={value}>
      <PrimitiveScrollView
        ref={scrollRef}
        testID={testID}
        contentPaddingBottom={contentPaddingBottom}
        onLayout={onViewportLayout}
        onContentHeightChange={onContentHeightChange}
        onScrollOffsetChange={onScrollOffsetChange}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {children}
      </PrimitiveScrollView>
    </InputScrollAncestorContext.Provider>
  )
}
