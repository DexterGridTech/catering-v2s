import {useCallback, useRef, type ReactNode} from 'react'
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

export const InputScrollArea = ({testID, children, contentPaddingBottom}: InputScrollAreaProps) => {
  const scrollRef = useRef<PrimitiveScrollViewHandle | null>(null)
  const currentOffsetRef = useRef(0)
  const viewportSizeRef = useRef<Readonly<{readonly width: number; readonly height: number}> | null>(null)
  const contentHeightRef = useRef<number | null>(null)
  const requestSerialRef = useRef(0)
  const readbackRef = useRef<ScrollReadback | null>(null)
  const geometry = useInputSurfaceGeometry()
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
    const applyMeasurement = () => {
      if (requestSerialRef.current !== requestSerial || viewportRect === null || contentFieldRect === null) return
      const currentOffset = currentOffsetRef.current
      const fieldRect: LayoutRect = {
        x: viewportRect.x + contentFieldRect.x,
        y: viewportRect.y + contentFieldRect.y - currentOffset,
        width: contentFieldRect.width,
        height: contentFieldRect.height,
      }
      const presentationOffsetY = geometry.presentFocusRect(fieldId, fieldRect)
      const keyboardHeight = geometry.keyboardHeight > 0 ? geometry.keyboardHeight : requestedKeyboardHeight
      const maxScroll = Math.max(0, contentHeight - viewportSize.height)
      const nextOffset = calculateScrollOffset({
        inputRect: fieldRect,
        viewportRect,
        currentOffset,
        maxScroll,
        surfaceHeight: geometry.surfaceHeight,
        keyboardHeight,
        presentationOffsetY,
      })
      const intersection = visibleVerticalIntersectionOf({
        viewportRect,
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
        contentFieldRect,
        viewportRect,
        surfaceHeight: geometry.surfaceHeight,
        keyboardHeight,
        presentationOffsetY,
        requestedOffset: nextOffset,
      }
      if (nextOffset === currentOffset) {
        readbackRef.current = null
        if (visibleAtRequestedOffset) geometry.reportFocusVisibilitySuccess(fieldId)
        else geometry.reportFocusVisibilityFailure(fieldId, 'scroll-range-insufficient')
        return
      }
      geometry.scheduleScrollAtPresentationStart(fieldId, () => {
        if (requestSerialRef.current !== requestSerial) return
        scroll.scrollTo({y: nextOffset, animated: true})
      })
    }

    scroll.measureLayout(
      surfaceRoot,
      (x, y, width, height) => {
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
          geometry.reportFocusVisibilityFailure(fieldId, 'invalid-scroll-viewport-rectangle')
          return
        }
        viewportRect = {x, y, width, height}
        applyMeasurement()
      },
      () => {
        geometry.reportFocusVisibilityFailure(fieldId, 'scroll-viewport-measurement-failed')
      },
    )
    input.measureLayout(
      contentNode,
      (x, y, width, height) => {
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
          geometry.reportFocusVisibilityFailure(fieldId, 'invalid-scroll-field-rectangle')
          return
        }
        contentFieldRect = {x, y, width, height}
        applyMeasurement()
      },
      () => {
        geometry.reportFocusVisibilityFailure(fieldId, 'scroll-field-measurement-failed')
      },
    )
  }, [
    geometry?.keyboardHeight,
    geometry?.cancelScheduledScroll,
    geometry?.presentFocusRect,
    geometry?.reportFocusVisibilityFailure,
    geometry?.surfaceHeight,
    geometry?.surfaceRoot,
    geometry?.scheduleScrollAtPresentationStart,
  ])

  const onScrollOffsetChange = useCallback((offsetY: number) => {
    const nextOffset = Math.max(0, offsetY)
    currentOffsetRef.current = nextOffset
    const pending = readbackRef.current
    if (pending !== null) {
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
      const targetReached = Math.abs(nextOffset - pending.requestedOffset) <= 0.5
      if (fullyVisible) {
        readbackRef.current = null
        geometry?.reportFocusVisibilitySuccess(pending.fieldId)
      } else if (targetReached) {
        readbackRef.current = null
        geometry?.reportFocusVisibilityFailure(pending.fieldId, 'scroll-clamped-before-visible')
      }
    }
  }, [geometry?.reportFocusVisibilityFailure, geometry?.reportFocusVisibilitySuccess])

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
      >
        {children}
      </PrimitiveScrollView>
    </InputScrollAncestorContext.Provider>
  )
}
