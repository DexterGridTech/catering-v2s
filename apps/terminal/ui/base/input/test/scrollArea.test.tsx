import {act, create, type ReactTestInstance, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it, vi} from 'vitest'
import {PrimitiveInput} from '@catering-v2s/ui-base-primitives'
import {ScrollView, TextInput} from 'react-native'
import {InputScrollArea} from '../src/components/InputScrollArea'
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame'
import {useInputField} from '../src/hooks/useInputField'

const Field = () => {
  const field = useInputField({
    fieldId: 'scroll-field',
    testID: 'sample:scroll-field',
    accessibilityLabel: 'scroll-field',
    keyboardKind: 'virtual',
    layout: 'numeric',
  })
  return <PrimitiveInput {...field.inputProps} />
}

const createWithNodeMock = create as unknown as (
  element: Parameters<typeof create>[0],
  options: Readonly<{readonly createNodeMock: (element: ReactTestInstance) => unknown}>,
) => ReactTestRenderer

const mountWithNativeGeometry = (scrollTo: (options: Readonly<{readonly y: number; readonly animated?: boolean}>) => void): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = createWithNodeMock(
      <InputSurfaceFrame>
        <InputScrollArea testID="sample:scroll-area">
          <Field />
        </InputScrollArea>
      </InputSurfaceFrame>,
      {
        createNodeMock: (element: ReactTestInstance) => {
          if (element.props.testID === 'sample:scroll-field') {
            return {
              measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 260, 100, 40),
              focus: () => undefined,
              blur: () => undefined,
            }
          }
          if (element.props.testID === 'sample:scroll-area' && element.type === ScrollView) {
            return {
              measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 0, 300, 270),
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
      nativeEvent: {layout: {width: 962, height: 541}},
    })
  })
  return renderer!
}

describe('InputScrollArea', () => {
  it('measures a focused field and scrolls the real primitive ancestor into the shrunken viewport', () => {
    const scrollTo = vi.fn()
    const renderer = mountWithNativeGeometry(scrollTo)
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    expect(scrollTo).toHaveBeenCalledWith({y: 30, animated: true})
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
        nativeEvent: {layout: {width: 962, height: 541}},
      })
    })
    const input = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:scroll-field')!
    expect(() => act(() => { input.props.onFocus({nativeEvent: {}}) })).not.toThrow()
    act(() => { renderer!.unmount() })
  })
})
