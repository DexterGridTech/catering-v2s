import {useLayoutEffect, type RefObject} from 'react'
import {act, create, type ReactTestInstance, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it, vi} from 'vitest'
import {PrimitiveInput, type PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives'
import {ScrollView, TextInput, View} from 'react-native'
import {InputScrollArea} from '../src/components/InputScrollArea'
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame'
import {useInputField} from '../src/hooks/useInputField'
import {useInputScrollAncestor} from '../src/contexts/context'
import type {InputDiagnostic} from '../src/types/types'

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
    onScrollReady(keyboardHeight => scrollAncestor(inputRef, keyboardHeight))
  }, [inputRef, onScrollReady, scrollAncestor])
  return <PrimitiveInput {...field.inputProps} />
}

const createWithNodeMock = create as unknown as (
  element: Parameters<typeof create>[0],
  options: Readonly<{readonly createNodeMock: (element: ReactTestInstance) => unknown}>,
) => ReactTestRenderer

const TEST_FRAME = {width: 960, height: 540} as const;

const mountWithNativeGeometry = (
  scrollTo: (options: Readonly<{readonly y: number; readonly animated?: boolean}>) => void,
  diagnostics: InputDiagnostic[],
): Readonly<{readonly renderer: ReactTestRenderer; readonly requestScroll: {readonly current: ScrollRequest | null}}> => {
  let renderer: ReactTestRenderer | undefined
  const requestScroll = {current: null as ScrollRequest | null}
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
        <InputSurfaceFrame onDiagnostic={diagnostic => diagnostics.push(diagnostic)}>
          <InputScrollArea testID="sample:scroll-area">
            <Field onScrollReady={onScrollReady} />
          </InputScrollArea>
        </InputSurfaceFrame>
      </View>,
      {
        createNodeMock: (element: ReactTestInstance) => {
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
    scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 100}}})
  })
  return {renderer: renderer!, requestScroll}
}

describe('InputScrollArea', () => {
  it('uses content-local coordinates when a scaled host has a non-zero scroll offset', () => {
    const scrollTo = vi.fn()
    const diagnostics: InputDiagnostic[] = []
    const {renderer, requestScroll} = mountWithNativeGeometry(scrollTo, diagnostics)
    expect(renderer.root.findByProps({testID: 'sample:scaled-host'}).props.style.transform).toEqual([
      {scaleX: 1.25},
      {scaleY: 0.5},
    ])
    const scrollView = renderer.root.findAllByType(ScrollView).find(node => node.props.testID === 'sample:scroll-area')!
    expect(requestScroll.current).not.toBeNull()
    act(() => { requestScroll.current!(100) })
    act(() => { requestScroll.current!(100) })
    expect(scrollTo).toHaveBeenCalledTimes(2)
    if (__DEV__) {
      const intoViewEvents = diagnostics.filter(diagnostic => diagnostic.event === 'input.scroll-into-view')
      expect(intoViewEvents).toHaveLength(2)
      expect(intoViewEvents[0]).toMatchObject({
        data: {beforeOffset: 100, delta: 200, requestedOffset: 300, units: 'logical-layout-unit'},
      })
      expect(intoViewEvents[1]).toMatchObject({
        data: {beforeOffset: 100, delta: 200, requestedOffset: 300, units: 'logical-layout-unit'},
      })
    }
    act(() => {
      scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 240}}})
    })
    act(() => { requestScroll.current!(100) })
    expect(scrollTo).toHaveBeenLastCalledWith({y: 300, animated: true})
    if (__DEV__) {
      const postScrollIntoViewEvents = diagnostics.filter(diagnostic => diagnostic.event === 'input.scroll-into-view')
      expect(postScrollIntoViewEvents[postScrollIntoViewEvents.length - 1]).toMatchObject({
        data: {beforeOffset: 240, delta: 60, requestedOffset: 300, units: 'logical-layout-unit'},
      })
    }
    act(() => {
      scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 300}}})
    })
    if (__DEV__) {
      const scrollOffsetEvents = diagnostics.filter(diagnostic => diagnostic.event === 'input.scroll-offset')
      expect(scrollOffsetEvents[scrollOffsetEvents.length - 1]).toMatchObject({
        data: {offsetY: 300, units: 'logical-layout-unit'},
      })
    }
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
