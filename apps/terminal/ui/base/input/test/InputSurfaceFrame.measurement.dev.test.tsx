import {act, create, type ReactTestInstance, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it, vi} from 'vitest'
import {Pressable, StyleSheet, TextInput, View} from 'react-native'
import {PrimitiveInput, PrimitivePinInput, type PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives'
import {useSurfacePresentationOffset} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame'
import {useInputFieldKeyboardState, useInputKeyboardState, useInputScrollAncestor} from '../src/contexts/context'
import {useInputSurfaceGeometry} from '../src/contexts/InputSurfaceGeometryContext'
import {useInputField} from '../src/hooks/useInputField'
import type {InputFieldResult} from '../src/types/types'
import {advanceAnimatedTimingsForTests, setAnimatedTimingAutoFinishForTests} from '../../../../../../tools/terminal-shared/react-native-vitest-entry'

const measureKeyboardLayers = (renderer: ReactTestRenderer): void => {
  const measurementLayers = renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
  for (const layer of measurementLayers) {
    const backdrop = layer.findByProps({testID: 'ui.base.input:virtual-keyboard:backdrop'})
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{readonly width: number; readonly height: number}>
    act(() => { layer.props.onLayout({nativeEvent: {layout}}) })
  }
}

const finishKeyboardPresentation = (renderer: ReactTestRenderer): void => {
  setAnimatedTimingAutoFinishForTests(true)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'}).length === 0) break
    measureKeyboardLayers(renderer)
    act(() => { advanceAnimatedTimingsForTests(1) })
  }
}

const focusAndFinishKeyboard = (renderer: ReactTestRenderer, input: ReactTestInstance): void => {
  act(() => { input.props.onFocus({nativeEvent: {}}) })
  finishKeyboardPresentation(renderer)
}

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

const NativeLessPinField = ({onReady, onOffset}: Readonly<{
  readonly onReady: (field: InputFieldResult) => void
  readonly onOffset: (offset: unknown) => void
}>) => {
  const field = useInputField({
    fieldId: 'measurement-pin',
    testID: 'sample:measurement-pin',
    keyboardKind: 'virtual',
    layout: 'numeric',
    nativeLess: true,
  })
  onReady(field)
  const visibleAnchorRef = field.visibleAnchorRef
  onOffset(useSurfacePresentationOffset())
  return (
    <PrimitivePinInput
      testID="sample:measurement-pin-root"
      cellTestIDPrefix="sample:measurement-pin"
      value={field.inputProps.value ?? ''}
      length={6}
      measureRef={visibleAnchorRef}
      onPress={field.focus}
    />
  )
}

const FieldWithPresentationProbe = ({
  onOffset,
  onRoot,
  onInputHandle,
  onFieldState,
  onScrollAncestor,
}: Readonly<{
  readonly onOffset: (offset: unknown) => void
  readonly onRoot: (root: unknown) => void
  readonly onInputHandle: (handle: unknown) => void
  readonly onFieldState: (state: ReturnType<typeof useInputFieldKeyboardState>) => void
  readonly onScrollAncestor: (scrollAncestor: ReturnType<typeof useInputScrollAncestor>) => void
}>) => {
  const field = useInputField({
    fieldId: 'presentation-field',
    testID: 'sample:presentation-field',
    keyboardKind: 'virtual',
    layout: 'numeric',
  })
  onRoot(useInputSurfaceGeometry()?.surfaceRoot)
  const inputRef = field.inputProps.inputRef
  onInputHandle(inputRef !== null && inputRef !== undefined && typeof inputRef === 'object' && 'current' in inputRef
    ? inputRef.current
    : null)
  onFieldState(useInputFieldKeyboardState())
  onScrollAncestor(useInputScrollAncestor())
  onOffset(useSurfacePresentationOffset())
  return <PrimitiveInput {...field.inputProps} />
}

const PositionedField = ({
  fieldId,
  onOffset,
}: Readonly<{
  readonly fieldId: string
  readonly onOffset: (offset: unknown) => void
}>) => {
  const field = useInputField({
    fieldId,
    testID: `sample:${fieldId}`,
    keyboardKind: 'virtual',
    layout: 'numeric',
  })
  onOffset(useSurfacePresentationOffset())
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

const mountNativeLessPin = (pinRoot: unknown) => {
  let field: InputFieldResult | undefined
  let keyboardState: ReturnType<typeof useInputKeyboardState> | null = null
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = createWithNodeMock(
      <InputSurfaceFrame>
        <NativeLessPinField onReady={value => { field = value }} onOffset={() => undefined} />
        <KeyboardStateProbe onState={state => { keyboardState = state }} />
      </InputSurfaceFrame>,
      {
        createNodeMock: element => {
          if (element.type === View && element.props.testID === 'ui.base.input:surface-frame') return {}
          if (element.props.testID === 'sample:measurement-pin-root') return pinRoot
          return {}
        },
      },
    )
  })
  act(() => {
    renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
      nativeEvent: {layout: {width: 960, height: 800}},
    })
  })
  return {renderer: renderer!, getField: () => field, getKeyboardState: () => keyboardState}
}

describe('InputSurfaceFrame measured frame owner', () => {
  it('starts unmeasured, reports the actual pointer frame, and deduplicates equal layouts', () => {
    const measurements: Array<{width: number; height: number; ready: boolean; orientation: string}> = []
    let field: InputFieldResult | undefined
    const surfaceRoot = {}
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = createWithNodeMock(
        <InputSurfaceFrame onMeasuredFrame={frame => { measurements.push(frame) }}>
          <Field onReady={value => { field = value }} />
        </InputSurfaceFrame>,
        {
          createNodeMock: element => {
            if (element.type === View && element.props.testID === 'ui.base.input:surface-frame') return surfaceRoot
            if (element.props.testID === 'sample:measurement-field') {
              return {
                measureLayout: (
                  relativeTo: unknown,
                  callback: (x: number, y: number, width: number, height: number) => void,
                ) => {
                  expect(relativeTo).toBe(surfaceRoot)
                  callback(0, 300, 100, 40)
                },
                focus: () => undefined,
                blur: () => undefined,
              }
            }
            return {}
          },
        },
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
    focusAndFinishKeyboard(renderer!, input)
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { field?.blur() })
    act(() => { renderer!.unmount() })
  })

  it('measures an ordinary focused field against the unshifted surface root and applies one centered offset', () => {
    const surfaceRoot = {}
    let presentationOffset: unknown = null
    let measuredRoot: unknown = null
    let inputHandle: unknown = null
    let fieldState: ReturnType<typeof useInputFieldKeyboardState> | null = null
    let scrollAncestor: ReturnType<typeof useInputScrollAncestor> | null = null
    let keyboardState: ReturnType<typeof useInputKeyboardState> | null = null
    const measureFocusedField = vi.fn((relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
      expect(relativeTo).toBe(surfaceRoot)
      callback(0, 600, 100, 40)
    })
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = createWithNodeMock(
        <InputSurfaceFrame>
          <FieldWithPresentationProbe
            onOffset={offset => { presentationOffset = offset }}
            onRoot={root => { measuredRoot = root }}
            onInputHandle={handle => { inputHandle = handle }}
            onFieldState={state => { fieldState = state }}
            onScrollAncestor={ancestor => { scrollAncestor = ancestor }}
          />
          <KeyboardStateProbe onState={state => { keyboardState = state }} />
        </InputSurfaceFrame>,
        {
          createNodeMock: element => {
            if (element.type === View && element.props.testID === 'ui.base.input:surface-frame') return surfaceRoot
            if (element.props.testID === 'sample:presentation-field') {
              return {
                measureInWindow: () => { throw new Error('window coordinates must not drive field geometry') },
                measureLayout: measureFocusedField,
                focus: () => undefined,
                blur: () => undefined,
              }
            }
            return {}
          },
        },
      )
    })
    act(() => {
      renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
        nativeEvent: {layout: {width: 960, height: 800}},
      })
    })
    expect(measuredRoot).toBe(surfaceRoot)
    const input = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:presentation-field')!
    const nativeInputHandle = inputHandle as PrimitiveInputHandle
    nativeInputHandle.measureLayout(surfaceRoot as never, vi.fn())
    expect(measureFocusedField).toHaveBeenCalledTimes(1)
    measureFocusedField.mockClear()
    focusAndFinishKeyboard(renderer!, input)
    expect(keyboardState).toMatchObject({activeFieldId: 'presentation-field', owner: 'virtual', visible: true})
    expect(fieldState).toMatchObject({activeFieldId: 'presentation-field', owner: 'virtual', visible: true, height: 246})
    expect(scrollAncestor).toBeNull()
    expect(inputHandle).toEqual(expect.objectContaining({measureLayout: expect.any(Function)}))
    // Pending-focus preflight and the committed active phase each verify the same root-local frame.
    expect(measureFocusedField).toHaveBeenCalledTimes(2)
    expect(presentationOffset).toBe(-246)
    act(() => { renderer!.unmount() })
  })

  it('recomputes the next field from its unshifted root-local position without subtracting the old offset', () => {
    const surfaceRoot = {}
    let presentationOffset: unknown = 0
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = createWithNodeMock(
        <InputSurfaceFrame>
          <PositionedField fieldId="first-positioned" onOffset={offset => { presentationOffset = offset }} />
          <PositionedField fieldId="second-positioned" onOffset={offset => { presentationOffset = offset }} />
        </InputSurfaceFrame>,
        {
          createNodeMock: element => {
            if (element.type === View && element.props.testID === 'ui.base.input:surface-frame') return surfaceRoot
            if (element.props.testID === 'sample:first-positioned' || element.props.testID === 'sample:second-positioned') {
              const y = element.props.testID === 'sample:first-positioned' ? 600 : 400
              return {
                measureLayout: (
                  relativeTo: unknown,
                  callback: (x: number, y: number, width: number, height: number) => void,
                ) => {
                  expect(relativeTo).toBe(surfaceRoot)
                  callback(0, y, 100, 40)
                },
                focus: () => undefined,
                blur: () => undefined,
              }
            }
            return {}
          },
        },
      )
    })
    act(() => {
      renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
        nativeEvent: {layout: {width: 960, height: 800}},
      })
    })
    const first = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:first-positioned')!
    const second = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:second-positioned')!
    focusAndFinishKeyboard(renderer!, first)
    expect(presentationOffset).toBe(-246)
    focusAndFinishKeyboard(renderer!, second)
    expect(presentationOffset).toBe(-143)
    act(() => { renderer!.unmount() })
  })

  it('measures a native-less PIN from its actual Pressable root against the unshifted surface', () => {
    const surfaceRoot = {}
    const measureCard = vi.fn(() => { throw new Error('PIN geometry must not use the surrounding card') })
    const cardRoot = {measureLayout: measureCard}
    let field: InputFieldResult | undefined
    let pinY = 400
    const measurePin = vi.fn((relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
      expect(relativeTo).toBe(surfaceRoot)
      callback(0, pinY, 120, 40)
    })
    const pinRoot = {
      measureLayout: measurePin,
      measureInWindow: () => { throw new Error('PIN geometry must not use window coordinates') },
    }
    let presentationOffset: unknown = null
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = createWithNodeMock(
        <InputSurfaceFrame>
          <View testID="sample:pin-card">
            <NativeLessPinField onReady={value => { field = value }} onOffset={offset => { presentationOffset = offset }} />
          </View>
        </InputSurfaceFrame>,
        {
          createNodeMock: element => {
            if (element.type === View && element.props.testID === 'ui.base.input:surface-frame') return surfaceRoot
            if (element.type === View && element.props.testID === 'sample:pin-card') return cardRoot
            if (element.props.testID === 'sample:measurement-pin-root') {
              return pinRoot
            }
            return {}
          },
        },
      )
    })
    act(() => {
      renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
        nativeEvent: {layout: {width: 960, height: 800}},
      })
    })
    const pin = renderer!.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:measurement-pin-root')!
    act(() => { pin.props.onPress() })
    finishKeyboardPresentation(renderer!)
    expect(measurePin).toHaveBeenCalledTimes(2)
    expect(field?.visibleAnchorRef?.current).toBe(pinRoot)
    expect(measureCard).not.toHaveBeenCalled()
    expect(measurePin.mock.calls[0]?.[0]).toBe(surfaceRoot)
    expect(measurePin.mock.calls[0]?.[1]).toEqual(expect.any(Function))
    expect(presentationOffset).toBe(-143)
    pinY = 300
    act(() => {
      renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
        nativeEvent: {layout: {width: 800, height: 800}},
      })
    })
    finishKeyboardPresentation(renderer!)
    // The resize invalidates the prior geometry generation and forces a fresh measurement.
    expect(measurePin).toHaveBeenCalledTimes(3)
    expect(presentationOffset).toBe(-43)
    act(() => { renderer!.unmount() })
  })

  it('releases a native-less PIN field and shows recovery when its measured bounds are invalid', () => {
    const invalidPinRoot = {
      measureLayout: (_relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
        callback(0, 400, 0, 40)
      },
    }
    const {renderer, getField, getKeyboardState} = mountNativeLessPin(invalidPinRoot)
    const before = getField()!.captureInputSnapshot()
    const pin = renderer.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:measurement-pin-root')!

    act(() => { pin.props.onPress() })

    expect(renderer.root.findByProps({testID: 'ui.base.input:focus-visibility-error'}).props.children)
      .toBe('焦点框无法完整显示，请调整窗口尺寸或退出输入')
    expect(getKeyboardState()).toMatchObject({activeFieldId: null, owner: 'none'})
    expect(getField()!.captureInputSnapshot().fields).toEqual(before.fields)
    act(() => { renderer.unmount() })
  })

  it('releases a native-less PIN field and shows recovery when its visible anchor is unavailable', () => {
    const {renderer, getField, getKeyboardState} = mountNativeLessPin(null)
    const before = getField()!.captureInputSnapshot()
    const pin = renderer.root.findAllByType(Pressable).find(node => node.props.testID === 'sample:measurement-pin-root')!

    act(() => { pin.props.onPress() })

    expect(renderer.root.findByProps({testID: 'ui.base.input:focus-visibility-error'}).props.children)
      .toBe('焦点框无法完整显示，请调整窗口尺寸或退出输入')
    expect(getKeyboardState()).toMatchObject({activeFieldId: null, owner: 'none'})
    expect(getField()!.captureInputSnapshot().fields).toEqual(before.fields)
    act(() => { renderer.unmount() })
  })
})
