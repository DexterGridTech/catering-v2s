import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {TextInput} from 'react-native'
import {PrimitiveInput} from '@catering-v2s/ui-base-primitives'
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame'
import {useInputField} from '../src/hooks/useInputField'
import type {InputFieldResult} from '../src/types/types'

const Field = ({onReady}: Readonly<{readonly onReady: (field: InputFieldResult) => void}>) => {
  const field = useInputField({
    fieldId: 'measurement-field',
    testID: 'sample:measurement-field',
    accessibilityLabel: 'measurement-field',
    keyboardKind: 'virtual',
    layout: 'numeric',
  })
  onReady(field)
  return <PrimitiveInput {...field.inputProps} />
}

describe('InputSurfaceFrame measured frame owner', () => {
  it('starts unmeasured, reports the actual pointer frame, and deduplicates equal layouts', () => {
    const measurements: Array<{width: number; height: number; ready: boolean; orientation: string}> = []
    let field: InputFieldResult | undefined
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        <InputSurfaceFrame onMeasuredFrame={frame => { measurements.push(frame) }}>
          <Field onReady={value => { field = value }} />
        </InputSurfaceFrame>,
      )
    })
    expect(renderer!.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    const frame = renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'})
    act(() => {
      frame.props.onLayout({nativeEvent: {layout: {width: 360, height: 640}}})
      frame.props.onLayout({nativeEvent: {layout: {width: 360, height: 640}}})
    })
    expect(measurements).toEqual([{width: 360, height: 640, ready: true, orientation: 'portrait'}])
    act(() => {
      frame.props.onLayout({nativeEvent: {layout: {width: 420, height: 700}}})
    })
    expect(measurements).toEqual([
      {width: 360, height: 640, ready: true, orientation: 'portrait'},
      {width: 420, height: 700, ready: true, orientation: 'portrait'},
    ])
    const input = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:measurement-field')!
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { field?.blur() })
    act(() => { renderer!.unmount() })
  })
})
