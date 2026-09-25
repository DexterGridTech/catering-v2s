import {useLayoutEffect, type RefObject} from 'react'
import {act, create, type ReactTestInstance, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it, vi} from 'vitest'
import {PrimitiveInput, type PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives'
import {ScrollView, TextInput, View} from 'react-native'
import {InputScrollArea} from '../src/components/InputScrollArea'
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame'
import {useInputField} from '../src/hooks/useInputField'
import {useInputKeyboardState, useInputScrollAncestor} from '../src/contexts/context'
import {advanceAnimatedTimingsForTests, setAnimatedTimingAutoFinishForTests} from '../../../../../../tools/terminal-shared/react-native-vitest-entry'

type InputRef = RefObject<PrimitiveInputHandle | null>
type ScrollRequest = (keyboardHeight: number) => void

const Field = ({onScrollReady}: Readonly<{readonly onScrollReady?: (request: ScrollRequest) => void}>) => {
  const field = useInputField({
    fieldId: 'scroll-field',
    testID: 'sample:scroll-field',
    accessibilityLabel: 'scroll-field',
    keyboardKind: 'virtual',
    layout: 'numeric',
  })
  const scrollAncestor = useInputScrollAncestor()
  const inputRef = field.inputProps.inputRef as InputRef
  useLayoutEffect(() => {
    if (scrollAncestor === null || onScrollReady === undefined) return
    onScrollReady(keyboardHeight => scrollAncestor('scroll-field', inputRef, keyboardHeight))
  }, [inputRef, onScrollReady, scrollAncestor])
  return <PrimitiveInput {...field.inputProps} />
}

const KeyboardStateProbe = ({onState}: Readonly<{readonly onState: (state: ReturnType<typeof useInputKeyboardState>) => void}>) => {
  onState(useInputKeyboardState())
  return null
}

const createWithNodeMock = create as unknown as (
  element: Parameters<typeof create>[0],
  options: Readonly<{readonly createNodeMock: (element: ReactTestInstance) => unknown}>,
) => ReactTestRenderer

const measureIncomingKeyboard = (renderer: ReactTestRenderer): void => {
  const layer = renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
  act(() => { layer.props.onLayout({nativeEvent: {layout: {height: 246}}}) })
}

const TEST_FRAME = {width: 960, height: 540} as const;

const mountWithNativeGeometry = (
  scrollTo: (options: Readonly<{readonly y: number; readonly animated?: boolean}>) => void,
  contentHeight = 900,
): Readonly<{
  readonly renderer: ReactTestRenderer
  readonly requestScroll: {readonly current: ScrollRequest | null}
  readonly keyboardState: {current: ReturnType<typeof useInputKeyboardState> | null}
}> => {
  let renderer: ReactTestRenderer | undefined
  const requestScroll = {current: null as ScrollRequest | null}
  const keyboardState = {current: null as ReturnType<typeof useInputKeyboardState> | null}
  const surfaceRootNode = {}
  const contentNativeNode = {}
  const onScrollReady = (request: ScrollRequest) => {
    requestScroll.current = request
  }
  act(() => {
    renderer = createWithNodeMock(
      <View
        testID="sample:scaled-host"
        style={{transform: [{scaleX: 1.25}, {scaleY: 0.5}]}}
      >
        <InputSurfaceFrame>
          <InputScrollArea testID="sample:scroll-area">
            <Field onScrollReady={onScrollReady} />
          </InputScrollArea>
          <KeyboardStateProbe onState={state => { keyboardState.current = state }} />
        </InputSurfaceFrame>
      </View>,
      {
        createNodeMock: (element: ReactTestInstance) => {
          if (element.type === View && element.props.testID === 'ui.base.input:surface-frame') return surfaceRootNode
          if (element.props.testID === 'sample:scroll-field') {
            return {
              measureInWindow: () => { throw new Error('window coordinates must not drive scroll delta') },
              measureLayout: (
                relativeToNativeNode: unknown,
                callback: (x: number, y: number, width: number, height: number) => void,
              ) => {
                expect(relativeToNativeNode).toBe(contentNativeNode)
                callback(0, 530, 100, 40)
              },
              focus: () => undefined,
              blur: () => undefined,
            }
          }
          if (element.props.testID === 'sample:scroll-area' && element.type === ScrollView) {
            return {
              measureInWindow: () => { throw new Error('window coordinates must not drive scroll delta') },
              measureLayout: (
                relativeToNativeNode: unknown,
                callback: (x: number, y: number, width: number, height: number) => void,
              ) => {
                expect(relativeToNativeNode).toBe(surfaceRootNode)
                callback(40, 80, 300, 270)
              },
              getInnerViewRef: () => contentNativeNode,
              getInnerViewNode: () => { throw new Error('numeric content node must not be used') },
              scrollTo,
            }
          }
          return {}
        },
      },
    )
  })
  act(() => {
    renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
      nativeEvent: {layout: TEST_FRAME},
    })
  })
  const scrollView = renderer!.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!
  act(() => {
    scrollView.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: 300, height: 270}}})
    scrollView.props.onContentSizeChange(300, contentHeight)
    scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 100}}})
  })
  return {renderer: renderer!, requestScroll, keyboardState}
}

describe('InputScrollArea', () => {
  it('forwards a presentation-only trailing content inset to the shared scroll primitive', () => {
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(<InputScrollArea testID="sample:scroll-padding" contentPaddingBottom={64}>内容</InputScrollArea>)
    })
    const scrollView = renderer!.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-padding')!
    expect(scrollView.props.contentContainerStyle).toEqual({gap: 12, paddingBottom: 64})
    act(() => {
      renderer!.unmount()
    })
  })

  it('uses content-local coordinates when a scaled host has a non-zero scroll offset', () => {
    const scrollTo = vi.fn()
    const {renderer, requestScroll} = mountWithNativeGeometry(scrollTo)
    expect(renderer.root.findByProps({testID: 'sample:scaled-host'}).props.style.transform).toEqual([
      {scaleX: 1.25},
      {scaleY: 0.5},
    ])
    const scrollView = renderer.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!
    expect(requestScroll.current).not.toBeNull()
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      measureIncomingKeyboard(renderer)
      act(() => { requestScroll.current!(100) })
      expect(scrollTo).toHaveBeenLastCalledWith({y: 300, animated: true})
      const requestedOffset = scrollTo.mock.calls.at(-1)?.[0]?.y
      expect(requestedOffset).toBe(300)
      act(() => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset}}})
      })
      act(() => { advanceAnimatedTimingsForTests(1) })
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('starts exactly one animated scroll request with the measured keyboard entrance and commits after readback', () => {
    const scrollTo = vi.fn()
    const {renderer, keyboardState} = mountWithNativeGeometry(scrollTo)
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    const scrollView = renderer.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!

    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      expect(scrollTo).not.toHaveBeenCalled()
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'})

      const measureLayer = renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
      act(() => { measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}}) })
      expect(scrollTo).toHaveBeenCalledTimes(1)
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({animated: true}))
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'})

      const requestedOffset = scrollTo.mock.calls[0]?.[0]?.y
      expect(requestedOffset).toEqual(expect.any(Number))
      act(() => { scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset}}}) })
      act(() => { advanceAnimatedTimingsForTests(1) })
      expect(keyboardState.current).toMatchObject({activeFieldId: 'scroll-field', owner: 'virtual'})
      expect(scrollTo).toHaveBeenCalledTimes(1)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('keeps readback pending at keyboard animation completion until the final scroll event proves visibility', () => {
    const scrollTo = vi.fn()
    const {renderer, keyboardState} = mountWithNativeGeometry(scrollTo)
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    const scrollView = renderer.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!

    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      const measureLayer = renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
      act(() => { measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}}) })
      expect(scrollTo).toHaveBeenCalledTimes(1)
      const requestedOffset = scrollTo.mock.calls[0]?.[0]?.y
      expect(requestedOffset).toEqual(expect.any(Number))
      act(() => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: Math.max(0, requestedOffset - 20)}}})
      })
      act(() => { advanceAnimatedTimingsForTests(1) })
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'})
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:focus-visibility-error'})).toHaveLength(0)
      act(() => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset}}})
      })
      expect(keyboardState.current).toMatchObject({activeFieldId: 'scroll-field', owner: 'virtual'})
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('settles an invisible readback from a terminal drag event even when no onScroll arrives', () => {
    const scrollTo = vi.fn()
    const {renderer, keyboardState} = mountWithNativeGeometry(scrollTo, 550)
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    const scrollView = renderer.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!

    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      const measureLayer = renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
      act(() => { measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}}) })
      expect(scrollTo).toHaveBeenCalledTimes(1)
      act(() => {
        scrollView.props.onScrollEndDrag({nativeEvent: {
          contentOffset: {y: 100},
          velocity: {y: 0},
        }})
      })
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'})
      expect(renderer.root.findByProps({testID: 'ui.base.input:focus-visibility-error'}).props.children)
        .toBe('焦点框无法完整显示，请调整窗口尺寸或退出输入')
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('uses one bounded watchdog when neither scroll readback nor a terminal event arrives', () => {
    vi.useFakeTimers()
    const scrollTo = vi.fn()
    const {renderer, keyboardState} = mountWithNativeGeometry(scrollTo, 550)
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!

    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      const measureLayer = renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
      act(() => { measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}}) })
      expect(scrollTo).toHaveBeenCalledTimes(1)
      act(() => { vi.advanceTimersByTime(1_500) })
      expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'})
      expect(renderer.root.findByProps({testID: 'ui.base.input:focus-visibility-error'}).props.children)
        .toBe('焦点框无法完整显示，请调整窗口尺寸或退出输入')
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      vi.useRealTimers()
      act(() => { renderer.unmount() })
    }
  })

  it('accepts a half-unit readback difference when the field is fully visible', () => {
    const scrollTo = vi.fn()
    const {renderer, keyboardState} = mountWithNativeGeometry(scrollTo)
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    const scrollView = renderer.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!

    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      const measureLayer = renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
      act(() => { measureLayer.props.onLayout({nativeEvent: {layout: {height: 246}}}) })
      const requestedOffset = scrollTo.mock.calls[0]?.[0]?.y
      expect(requestedOffset).toEqual(expect.any(Number))
      act(() => {
        scrollView.props.onScroll({nativeEvent: {contentOffset: {y: requestedOffset - 0.4}}})
      })
      act(() => { advanceAnimatedTimingsForTests(1) })
      expect(keyboardState.current).toMatchObject({activeFieldId: 'scroll-field', owner: 'virtual'})
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('releases focus and shows recovery when the scroll clamp is reached but the field remains clipped', () => {
    const scrollTo = vi.fn()
    const {renderer, requestScroll, keyboardState} = mountWithNativeGeometry(scrollTo, 550)
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    const scrollView = renderer.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!

    act(() => { input.props.onFocus({nativeEvent: {}}) })
    act(() => { requestScroll.current!(246) })
    measureIncomingKeyboard(renderer)
    expect(scrollTo).toHaveBeenLastCalledWith({y: 280, animated: true})
    act(() => { scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 280}}}) })

    expect(renderer.root.findByProps({testID: 'ui.base.input:focus-visibility-error'}).props.children)
      .toBe('焦点框无法完整显示，请调整窗口尺寸或退出输入')
    expect(keyboardState.current).toMatchObject({activeFieldId: null, owner: 'none'})
    act(() => { renderer.unmount() })
  })

  it('does not require a scroll ancestor when a field is focused', () => {
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        <InputSurfaceFrame>
          <Field />
        </InputSurfaceFrame>,
      )
    })
    act(() => {
      renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
        nativeEvent: {layout: TEST_FRAME},
      })
    })
    const input = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    expect(() => act(() => { input.props.onFocus({nativeEvent: {}}) })).not.toThrow()
    act(() => { renderer!.unmount() })
  })
})
