import {useCallback, useRef, type ReactNode} from 'react'
import type {LayoutChangeEvent} from 'react-native'
import {
  PrimitiveScrollView,
  type PrimitiveInputHandle,
  type PrimitiveScrollViewHandle,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollAncestorContext, useInputDiagnostic} from '../contexts/context'
import {calculateScrollOffset, type LayoutRect} from '../foundations/scrollIntoView'

export type InputScrollAreaProps = Readonly<{
  readonly testID: string
  readonly children?: ReactNode
}>

export const InputScrollArea = ({testID, children}: InputScrollAreaProps) => {
  const scrollRef = useRef<PrimitiveScrollViewHandle | null>(null)
  const currentOffsetRef = useRef(0)
  const viewportLayoutRef = useRef<Readonly<{readonly width: number; readonly height: number}> | null>(null)
  const reportDiagnostic = useInputDiagnostic()

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const {x, y, width, height} = event.nativeEvent.layout
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
    viewportLayoutRef.current = {width, height}
    if (__DEV__ && reportDiagnostic !== null) {
      reportDiagnostic({
        event: 'input.scroll-viewport-layout',
        data: {
          source: 'ui-base-input.InputScrollArea.onLayout',
          units: 'logical-layout-unit',
          x,
          y,
          width,
          height,
        },
      })
    }
  }, [reportDiagnostic])

  const ensureVisible = useCallback((inputRef: Readonly<{readonly current: PrimitiveInputHandle | null}> | null, keyboardHeight: number) => {
    const input = inputRef?.current ?? null
    const scroll = scrollRef.current
    const viewportLayout = viewportLayoutRef.current
    const contentNode = scroll?.getContentNativeNode() ?? null
    if (input === null || scroll === null || viewportLayout === null || contentNode === null) {
      if (__DEV__ && reportDiagnostic !== null) {
        reportDiagnostic({
          event: 'input.scroll-into-view-skipped',
          data: {
            source: 'ui-base-input.InputScrollArea',
            reason: input === null
              ? 'input-ref-unavailable'
              : scroll === null
                ? 'scroll-ref-unavailable'
                : viewportLayout === null
                  ? 'viewport-layout-unavailable'
                  : 'content-node-unavailable',
          },
        })
      }
      return
    }

    input.measureLayout(
      contentNode,
      (...measurements: [number, number, number, number]) => {
        const [inputX, inputY, inputWidth, inputHeight] = measurements
        const beforeOffset = currentOffsetRef.current
        const inputRect = {x: inputX, y: inputY, width: inputWidth, height: inputHeight}
        const viewportRect = {
          x: 0,
          y: beforeOffset,
          width: viewportLayout.width,
          height: viewportLayout.height,
        }
        const nextOffset = calculateScrollOffset({
          inputRect,
          viewportRect,
          currentOffset: beforeOffset,
          keyboardHeight,
          viewportAlreadyShrunk: true,
        })
        if (__DEV__ && reportDiagnostic !== null) {
          reportDiagnostic({
            event: 'input.scroll-into-view',
            data: {
              source: 'ui-base-input.InputScrollArea.measureLayout',
              units: 'logical-layout-unit',
              beforeOffset,
              inputX,
              inputY,
              inputWidth,
              inputHeight,
              viewportX: viewportRect.x,
              viewportY: viewportRect.y,
              viewportWidth: viewportRect.width,
              viewportHeight: viewportRect.height,
              keyboardHeight,
              delta: nextOffset - beforeOffset,
              requestedOffset: nextOffset,
            },
          })
        }
        if (nextOffset === beforeOffset) return
        scroll.scrollTo({y: nextOffset, animated: true})
      },
      () => {
        if (__DEV__ && reportDiagnostic !== null) {
          reportDiagnostic({
            event: 'input.scroll-into-view-failed',
            data: {
              source: 'ui-base-input.InputScrollArea.measureLayout',
              reason: 'measure-layout-failed',
            },
          })
        }
      },
    )
  }, [reportDiagnostic])

  const onScrollOffsetChange = useCallback((offsetY: number) => {
    const nextOffset = Math.max(0, offsetY)
    currentOffsetRef.current = nextOffset
    if (__DEV__ && reportDiagnostic !== null) {
      reportDiagnostic({
        event: 'input.scroll-offset',
        data: {
          source: 'ui-base-input.InputScrollArea.onScroll',
          units: 'logical-layout-unit',
          offsetY: nextOffset,
        },
      })
    }
  }, [reportDiagnostic])

  const value = useCallback((inputRef: Readonly<{readonly current: PrimitiveInputHandle | null}> | null, keyboardHeight: number) => {
    ensureVisible(inputRef, keyboardHeight)
  }, [ensureVisible])

  return (
    <InputScrollAncestorContext.Provider value={value}>
      <PrimitiveScrollView
        ref={scrollRef}
        testID={testID}
        onLayout={onViewportLayout}
        onScrollOffsetChange={onScrollOffsetChange}
      >
        {children}
      </PrimitiveScrollView>
    </InputScrollAncestorContext.Provider>
  )
}
