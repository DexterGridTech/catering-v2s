import {useCallback, useRef, type ReactNode} from 'react'
import {
  PrimitiveScrollView,
  type PrimitiveInputHandle,
  type PrimitiveScrollViewHandle,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollAncestorContext} from '../contexts/context'
import {calculateScrollOffset, type LayoutRect} from '../foundations/scrollIntoView'

export type InputScrollAreaProps = Readonly<{
  readonly testID: string
  readonly children?: ReactNode
}>

export const InputScrollArea = ({testID, children}: InputScrollAreaProps) => {
  const scrollRef = useRef<PrimitiveScrollViewHandle | null>(null)
  const currentOffsetRef = useRef(0)

  const ensureVisible = useCallback((inputRef: Readonly<{readonly current: PrimitiveInputHandle | null}>, keyboardHeight: number) => {
    const input = inputRef.current
    const scroll = scrollRef.current
    if (input === null || scroll === null) return

    input.measureInWindow((...inputLayout: [number, number, number, number]) => {
      const [inputX, inputY, inputWidth, inputHeight] = inputLayout
      scroll.measureInWindow((...viewportLayout: [number, number, number, number]) => {
        const [viewportX, viewportY, viewportWidth, viewportHeight] = viewportLayout
        const nextOffset = calculateScrollOffset({
          inputRect: {x: inputX, y: inputY, width: inputWidth, height: inputHeight},
          viewportRect: {x: viewportX, y: viewportY, width: viewportWidth, height: viewportHeight},
          currentOffset: currentOffsetRef.current,
          keyboardHeight,
          viewportAlreadyShrunk: true,
        })
        if (nextOffset === currentOffsetRef.current) return
        currentOffsetRef.current = nextOffset
        scroll.scrollTo({y: nextOffset, animated: true})
      })
    })
  }, [])

  const onScrollOffsetChange = useCallback((offsetY: number) => {
    currentOffsetRef.current = Math.max(0, offsetY)
  }, [])

  const value = useCallback((inputRef: Readonly<{readonly current: PrimitiveInputHandle | null}>, keyboardHeight: number) => {
    ensureVisible(inputRef, keyboardHeight)
  }, [ensureVisible])

  return (
    <InputScrollAncestorContext.Provider value={value}>
      <PrimitiveScrollView
        ref={scrollRef}
        testID={testID}
        onScrollOffsetChange={onScrollOffsetChange}
      >
        {children}
      </PrimitiveScrollView>
    </InputScrollAncestorContext.Provider>
  )
}
