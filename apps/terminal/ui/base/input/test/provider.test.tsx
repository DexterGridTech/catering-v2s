import {act, create, type ReactTestInstance, type ReactTestRenderer} from 'react-test-renderer'
import {PrimitiveButton, PrimitiveHeading, PrimitiveInput, PrimitivePinInput} from '@catering-v2s/ui-base-primitives'
import {useSurfaceFocusBoundary, type SurfaceFocusBoundaryListener} from '@catering-v2s/ui-base-render'
import {describe, expect, it, vi} from 'vitest'
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame'
import {InputKeyboard} from '../src/components/InputKeyboard'
import {VirtualKeyboard} from '../src/components/VirtualKeyboard'
import {useInputField} from '../src/hooks/useInputField'
import {useInputSnapshot} from '../src/hooks/useInputSnapshot'
import {useInputController, useInputKeyboardState, useInputPendingFocusCommit} from '../src/contexts/context'
import type {InputController, InputFieldResult} from '../src/types/types'
import {Animated, StyleSheet, TextInput, View} from 'react-native'
import {useRef, useState} from 'react'
import {advanceAnimatedTimingsForTests, setAnimatedTimingAutoFinishForTests} from '../../../../../../tools/terminal-shared/react-native-vitest-entry'

const TEST_FRAME = {width: 960, height: 540} as const

const applyLayout = (renderer: ReactTestRenderer, width: number = TEST_FRAME.width, height: number = TEST_FRAME.height): void => {
  act(() => {
    renderer.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
      nativeEvent: {layout: {width, height}},
    })
  })
}

const measureKeyboardLayers = (renderer: ReactTestRenderer): void => {
  const measurementLayers = renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})
  for (const layer of measurementLayers) {
    const backdrop = layer.findByProps({testID: 'ui.base.input:virtual-keyboard:backdrop'})
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{readonly width: number; readonly height: number}>
    act(() => {
      layer.props.onLayout({nativeEvent: {layout}})
    })
  }
}

const keyboardPositionLayers = (renderer: ReactTestRenderer) => renderer.root.findAllByType(Animated.View)
  .filter(layer => typeof layer.props.testID === 'string'
    && layer.props.testID.startsWith('ui.base.input:keyboard-layer-position:'))

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

const focusNativeHarnessAndFinish = (
  renderer: ReactTestRenderer,
  harness: NativeFocusHarness,
  testID: string,
): void => {
  act(() => { harness.focus(testID) })
  finishKeyboardPresentation(renderer)
}

const mount = (
  element: Parameters<typeof create>[0],
  size: Readonly<{readonly width: number; readonly height: number}> = TEST_FRAME,
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = createWithNodeMock(element, {createNodeMock: measuredNodeMock}) })
  applyLayout(renderer!, size.width, size.height)
  return renderer!
}

const createWithNodeMock = create as unknown as (
  element: Parameters<typeof create>[0],
  options: Readonly<{readonly createNodeMock: (element: ReactTestInstance) => unknown}>,
) => ReactTestRenderer

type NativeInputMock = Readonly<{
  readonly focus: () => void
  readonly blur: () => void
  readonly measureLayout: (
    relativeToNativeNode: unknown,
    callback: (x: number, y: number, width: number, height: number) => void,
    onFail?: () => void,
  ) => void
}>

const measuredNodeMock = (): NativeInputMock => ({
  focus: () => undefined,
  blur: () => undefined,
  measureLayout: (_relativeToNativeNode, callback) => callback(0, 100, 120, 40),
})

type NativeFocusHarness = Readonly<{
  readonly createNodeMock: (element: ReactTestInstance) => unknown
  readonly focus: (testID: string) => void
  readonly blurActive: () => void
  readonly isFocused: (testID: string) => boolean
}>

const createNativeFocusHarness = (): NativeFocusHarness => {
  const nodes = new Map<string, NativeInputMock>()
  let activeNode: NativeInputMock | null = null

  const createNodeMock = (element: ReactTestInstance): unknown => {
    const testID = element.props.testID
    if (typeof testID !== 'string' || !testID.startsWith('sample:owner-')) return measuredNodeMock()

    const node: NativeInputMock = {
      measureLayout: (_relativeToNativeNode, callback) => callback(0, 100, 120, 40),
      focus: () => {
        if (activeNode !== null && activeNode !== node) activeNode.blur()
        activeNode = node
        element.props.onFocus?.({nativeEvent: {}})
      },
      blur: () => {
        const wasActive = activeNode === node
        if (wasActive) activeNode = null
        if (wasActive) element.props.onBlur?.({nativeEvent: {}})
      },
    }
    nodes.set(testID, node)
    return node
  }

  return {
    createNodeMock,
    focus: testID => nodes.get(testID)?.focus(),
    blurActive: () => activeNode?.blur(),
    isFocused: testID => activeNode === nodes.get(testID),
  }
}

const focusableInputNodeMock = (element: ReactTestInstance): unknown => {
  if (typeof element.props.testID !== 'string' || !element.props.testID.startsWith('sample:complete-')) return measuredNodeMock()
  return {
    measureLayout: (_relativeToNativeNode: unknown, callback: (x: number, y: number, width: number, height: number) => void) => callback(0, 100, 120, 40),
    focus: () => {
      if (typeof element.props.onFocus === 'function') element.props.onFocus({nativeEvent: {}})
    },
    blur: () => {
      if (typeof element.props.onBlur === 'function') element.props.onBlur({nativeEvent: {}})
    },
  }
}

const mountWithFocusableInputs = (element: Parameters<typeof create>[0]): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = createWithNodeMock(element, {createNodeMock: focusableInputNodeMock})
  })
  applyLayout(renderer!)
  return renderer!
}

const mountWithNodeMock = (
  element: Parameters<typeof create>[0],
  createNodeMock: (element: ReactTestInstance) => unknown,
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = createWithNodeMock(element, {createNodeMock})
  })
  applyLayout(renderer!)
  return renderer!
}

const Field = ({
  fieldId,
  testID,
  nativeLess = false,
  layout = 'numeric',
  focusScopeId,
  onReady,
}: Readonly<{
  readonly fieldId: string
  readonly testID: string
  readonly nativeLess?: boolean
  readonly layout?: 'full' | 'alpha' | 'numeric' | 'financial'
  readonly focusScopeId?: string
  readonly keyboardKind?: 'virtual'
  readonly onReady: (result: InputFieldResult) => void
}>) => {
  const result = useInputField(
    {
      fieldId,
      testID,
      accessibilityLabel: fieldId,
      keyboardKind: 'virtual',
      layout,
      nativeLess,
      focusScopeId,
    },
  )
  onReady(result)
  if (nativeLess) {
    return (
      <PrimitivePinInput
        testID={testID}
        accessibilityLabel={fieldId}
        cellTestIDPrefix={`${testID}:digit`}
        length={6}
        measureRef={result.visibleAnchorRef}
        onPress={result.focus}
        value=""
      />
    )
  }
  return <PrimitiveInput {...result.inputProps} />
}

const SessionField = ({
  fieldId,
  onReady,
}: Readonly<{
  readonly fieldId: string
  readonly onReady: (result: InputFieldResult) => void
}>) => {
  const result = useInputField({
    fieldId,
    testID: `sample:${fieldId}`,
    accessibilityLabel: fieldId,
    keyboardKind: 'virtual',
    layout: 'full',
    nativeLess: true,
  })
  onReady(result)
  return (
    <PrimitivePinInput
      testID={`sample:${fieldId}`}
      accessibilityLabel={fieldId}
      cellTestIDPrefix={`sample:${fieldId}:digit`}
      length={6}
      measureRef={result.visibleAnchorRef}
      onPress={result.focus}
      value=""
    />
  )
}

const ControllerProbe = ({onReady}: Readonly<{readonly onReady: (controller: InputController) => void}>) => {
  onReady(useInputController())
  return null
}

const PendingFocusCommitProbe = ({onReady}: Readonly<{readonly onReady: (commit: (fieldId: string) => boolean) => void}>) => {
  onReady(useInputPendingFocusCommit())
  return null
}

const BoundaryProbe = ({onReady}: Readonly<{readonly onReady: (listener: SurfaceFocusBoundaryListener) => void}>) => {
  onReady(useSurfaceFocusBoundary())
  return null
}

const SnapshotProbe = ({onReady}: Readonly<{readonly onReady: (capture: () => ReturnType<ReturnType<typeof useInputSnapshot>>) => void}>) => {
  onReady(useInputSnapshot())
  return null
}

const RenderCountingField = ({
  fieldId,
  testID,
  onRender,
}: Readonly<{
  readonly fieldId: string
  readonly testID: string
  readonly keyboardKind?: 'virtual'
  readonly onRender: (count: number) => void
}>) => {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  onRender(renderCountRef.current)
  const result = useInputField(
    {
      fieldId,
      testID,
      accessibilityLabel: fieldId,
      keyboardKind: 'virtual',
      layout: 'numeric',
    },
  )
  return <PrimitiveInput {...result.inputProps} />
}

const StateProbe = ({onState}: Readonly<{readonly onState: (state: ReturnType<typeof useInputKeyboardState>) => void}>) => {
  onState(useInputKeyboardState())
  return <PrimitiveButton testID="sample:decision" onPress={() => undefined}>继续</PrimitiveButton>
}

const PassiveKeyboardHarness = () => {
  const [revision, setRevision] = useState(0)
  return (
    <>
      <InputKeyboard
        snapshot={{fieldId: 'passive', layout: 'numeric', height: 246, frameWidth: 960, shift: false, hasNextField: false}}
        interactive={false}
        testIDSuffix={String(revision)}
      />
      <PrimitiveButton testID="sample:rerender-passive" onPress={() => { setRevision(value => value + 1) }}>重绘</PrimitiveButton>
    </>
  )
}

describe('input provider', () => {
  it('keeps the content full-size and the keyboard overlay above render layers', () => {
    const renderer = mount(<InputSurfaceFrame />)
    const contentStyle = StyleSheet.flatten(renderer.root.findByProps({testID: 'ui.base.input:surface-content'}).props.style)
    const overlayStyle = StyleSheet.flatten(renderer.root.findByProps({testID: 'ui.base.input:keyboard-overlay'}).props.style)

    expect(contentStyle).toMatchObject({flex: 1, width: '100%'})
    expect(contentStyle).not.toHaveProperty('height')
    expect(overlayStyle).toMatchObject({position: 'absolute', right: 0, bottom: 0, left: 0})
    expect(overlayStyle.zIndex).toBeGreaterThan(1000)
    expect(overlayStyle.elevation).toBeGreaterThan(1000)
    act(() => { renderer.unmount() })
  })

  it('keeps independent keyboard widths on two surfaces in the same React tree', () => {
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = createWithNodeMock(
        <>
          <InputSurfaceFrame>
            <Field fieldId="primary-width" testID="sample:primary-width" onReady={() => undefined} />
          </InputSurfaceFrame>
          <InputSurfaceFrame>
            <Field fieldId="secondary-width" testID="sample:secondary-width" onReady={() => undefined} />
          </InputSurfaceFrame>
        </>,
        {createNodeMock: measuredNodeMock},
      )
    })
    const frames = renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'})
    act(() => {
      frames[0]!.props.onLayout({nativeEvent: {layout: {width: 1280, height: 800}}})
      frames[1]!.props.onLayout({nativeEvent: {layout: {width: 360, height: 720}}})
    })
    const primary = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:primary-width')!
    const secondary = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:secondary-width')!
    focusAndFinishKeyboard(renderer!, primary)
    focusAndFinishKeyboard(renderer!, secondary)
    const keyboards = renderer!.root.findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')
    expect(keyboards.map(node => StyleSheet.flatten(node.props.style).width)).toEqual([1280, 360])
    act(() => { renderer!.unmount() })
  })

  it('clears one-shot Shift when the active field session changes', () => {
    let firstField: InputFieldResult | undefined
    let secondField: InputFieldResult | undefined
    let keyboardState: ReturnType<typeof useInputKeyboardState> | undefined
    const onState = (state: ReturnType<typeof useInputKeyboardState>) => { keyboardState = state }
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={onState} />
        <SessionField fieldId="shift-first" onReady={result => { firstField = result }} />
        <SessionField fieldId="shift-second" onReady={result => { secondField = result }} />
      </InputSurfaceFrame>,
    )

    act(() => { firstField!.focus() })
    finishKeyboardPresentation(renderer)
    const shift = renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:shift'})
    act(() => { shift.props.onPress() })
    expect(keyboardState?.shift).toBe(true)

    act(() => { secondField!.focus() })
    finishKeyboardPresentation(renderer)
    expect(keyboardState?.activeFieldId).toBe('shift-second')
    expect(keyboardState?.shift).toBe(false)

    act(() => { firstField!.focus() })
    finishKeyboardPresentation(renderer)
    expect(keyboardState?.activeFieldId).toBe('shift-first')
    expect(keyboardState?.shift).toBe(false)
    act(() => { renderer.unmount() })
  })

  it('does not render or commit a virtual keyboard before the frame is measured', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = createWithNodeMock(
        <InputSurfaceFrame>
          <StateProbe onState={value => { state = value }} />
          <Field fieldId="unmeasured" testID="sample:unmeasured" keyboardKind="virtual" onReady={() => undefined} />
        </InputSurfaceFrame>,
        {createNodeMock: measuredNodeMock},
      )
    })

    expect(renderer!.root.findByProps({testID: 'sample:decision'})).toBeDefined()
    expect(renderer!.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    expect(state?.capacity).toBe('unmeasured')
    const input = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:unmeasured')!
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    expect(state?.activeFieldId).toBeNull()
    expect(renderer!.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)

    applyLayout(renderer!)
    focusAndFinishKeyboard(renderer!, input)
    expect(state?.activeFieldId).toBe('unmeasured')
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer!.unmount() })
  })

  it('clears a virtual owner when a resize makes the active layout infeasible', () => {
    let renderer: ReactTestRenderer | undefined
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    act(() => {
      renderer = createWithNodeMock(
        <InputSurfaceFrame>
          <StateProbe onState={value => { state = value }} />
          <Field fieldId="resized" testID="sample:resized" keyboardKind="virtual" onReady={() => undefined} />
        </InputSurfaceFrame>,
        {createNodeMock: measuredNodeMock},
      )
    })
    applyLayout(renderer!, TEST_FRAME.width, TEST_FRAME.height)
    const input = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:resized')!
    focusAndFinishKeyboard(renderer!, input)
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    try {
      setAnimatedTimingAutoFinishForTests(false)
      applyLayout(renderer!, 360, 300)
      expect(state?.owner).toBe('none')
      expect(renderer!.root.findByProps({testID: 'ui.base.input:unsupported-size'})).toBeDefined()
      expect(renderer!.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toBeDefined()
      expect(renderer!.root.findByProps({testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined()
      act(() => { advanceAnimatedTimingsForTests(0.5) })
      expect(renderer!.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toBeDefined()
      act(() => { advanceAnimatedTimingsForTests(1) })
      expect(keyboardPositionLayers(renderer!)).toHaveLength(0)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer!.unmount() })
    }
  })

  it('retains the outgoing keyboard while its exit transition runs after the owner clears', () => {
    let controller: InputController | undefined
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <ControllerProbe onReady={value => { controller = value }} />
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="exit-transition" testID="sample:exit-transition" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:exit-transition')!

    try {
      focusAndFinishKeyboard(renderer, input)
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'}).length).toBeGreaterThan(0)

      setAnimatedTimingAutoFinishForTests(false)
      act(() => { controller!.dismissActiveField() })

      expect(state?.owner).toBe('none')
      expect(state?.visible).toBe(false)
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:outgoing-0'})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined()
      act(() => { advanceAnimatedTimingsForTests(0.5) })
      expect(state?.owner).toBe('none')
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:outgoing-0'})).toBeDefined()
    expect((renderer.root.findByProps({testID: 'ui.base.input:keyboard-layer-position:outgoing-0'}).props.style as readonly unknown[]).some(style => (style as {pointerEvents?: string} | null)?.pointerEvents === 'none')).toBe(true)
      expect(renderer.root.findByProps({testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined()
      act(() => { advanceAnimatedTimingsForTests(1) })
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:outgoing-0'})).toHaveLength(0)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('keeps frozen outgoing and incoming snapshots layered and input-blocked during a different-layout handoff', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="handoff-a" testID="sample:handoff-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="handoff-b" testID="sample:handoff-b" layout="full" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = (testID: string) => renderer.root.findAllByType(TextInput).find(node => node.props.testID === testID)!

    try {
      focusAndFinishKeyboard(renderer, input('sample:handoff-a'))
      act(() => { renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:shift'}).props.onPress() })
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-a'}).props.children).toBe('A')
      setAnimatedTimingAutoFinishForTests(false)
      const target = input('sample:handoff-b')
      act(() => { target.props.onPressIn({stopPropagation: () => undefined}) })
      expect(state?.owner).toBe('none')
      expect(state?.activeFieldId).toBeNull()
      expect(state?.blockedFieldId).toBe('handoff-b')
      expect(state?.blockedCapacity).toBeNull()

      act(() => { target.props.onFocus({nativeEvent: {}}) })
      expect(state?.owner).toBe('none')
      expect(state?.activeFieldId).toBeNull()
      measureKeyboardLayers(renderer)
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'}).length).toBeGreaterThan(0)
      const positionLayers = keyboardPositionLayers(renderer)
      expect(positionLayers.map(layer => layer.props.testID)).toEqual([
        'ui.base.input:keyboard-layer-position:active',
        'ui.base.input:keyboard-layer-position:outgoing-0',
      ])
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-a:outgoing-0'}).props.children).toBe('A')
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'}).props.children).toBe('1')
      const shield = renderer.root.findByProps({testID: 'ui.base.input:keyboard-hit-shield'})
    expect(shield.props.style).toEqual(expect.arrayContaining([expect.objectContaining({pointerEvents: 'auto'})]))
      expect(shield.props.onStartShouldSetResponder()).toBe(true)
      expect(shield.props.onMoveShouldSetResponder()).toBe(true)
      expect(shield.props.onResponderTerminationRequest()).toBe(false)
    expect(positionLayers.every(layer => (Array.isArray(layer.props.style) ? layer.props.style : [layer.props.style]).some((style: unknown) => (style as {pointerEvents?: string} | null)?.pointerEvents === 'none'))).toBe(true)
      act(() => { advanceAnimatedTimingsForTests(0.4) })
      expect(state?.owner).toBe('none')
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-a:outgoing-0'}).props.children).toBe('A')
      expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined()
      expect(renderer.root.findByProps({testID: 'ui.base.input:keyboard-hit-shield'})).toBeDefined()
      act(() => { advanceAnimatedTimingsForTests(1) })
      expect(state?.activeFieldId).toBe('handoff-b')
      expect(state?.owner).toBe('virtual')
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'}).length).toBeGreaterThan(0)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('retargets an in-flight handoff to the latest pending field without committing the stale target', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="retarget-a" testID="sample:retarget-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="retarget-b" testID="sample:retarget-b" layout="full" onReady={() => undefined} />
        <Field fieldId="retarget-c" testID="sample:retarget-c" layout="financial" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = (testID: string) => renderer.root.findAllByType(TextInput).find(node => node.props.testID === testID)!
    const renderedKeyboardCount = () => renderer.root.findAllByType(View)
      .filter(node => node.props.testID === 'ui.base.input:virtual-keyboard').length
    const requestFocus = (testID: string): void => {
      const target = input(testID)
      act(() => { target.props.onPressIn({stopPropagation: () => undefined}) })
      act(() => { target.props.onFocus({nativeEvent: {}}) })
    }

    try {
      focusAndFinishKeyboard(renderer, input('sample:retarget-a'))
      setAnimatedTimingAutoFinishForTests(false)
      requestFocus('sample:retarget-b')
      measureKeyboardLayers(renderer)
      expect(state?.blockedFieldId).toBe('retarget-b')
      act(() => { advanceAnimatedTimingsForTests(0.4) })

      requestFocus('sample:retarget-c')
      expect(state?.owner).toBe('none')
      expect(state?.activeFieldId).toBeNull()
      expect(state?.blockedFieldId).toBe('retarget-c')
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'}).length).toBeGreaterThan(0)
      measureKeyboardLayers(renderer)
      act(() => { advanceAnimatedTimingsForTests(1) })

      expect(state?.activeFieldId).toBe('retarget-c')
      expect(state?.owner).toBe('virtual')
      expect(state?.layout).toBe('financial')
      expect(state?.blockedFieldId).toBeNull()
      expect(renderedKeyboardCount()).toBe(1)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('keeps frozen keyboard layer identities unique across rapid A-to-B-to-A-to-C retargets', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const duplicateKeyError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="rapid-a" testID="sample:rapid-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="rapid-b" testID="sample:rapid-b" layout="full" onReady={() => undefined} />
        <Field fieldId="rapid-c" testID="sample:rapid-c" layout="financial" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = (testID: string) => renderer.root.findAllByType(TextInput).find(node => node.props.testID === testID)!
    const requestFocus = (testID: string): void => {
      const target = input(testID)
      act(() => { target.props.onPressIn({stopPropagation: () => undefined}) })
      act(() => { target.props.onFocus({nativeEvent: {}}) })
    }
    const assertLayerKeysUnique = (): void => {
      const keys = keyboardPositionLayers(renderer).map(layer => layer.props.nativeID)
      expect(keys.every(key => typeof key === 'string' && key.length > 0)).toBe(true)
      expect(new Set(keys).size).toBe(keys.length)
    }

    try {
      focusAndFinishKeyboard(renderer, input('sample:rapid-a'))
      setAnimatedTimingAutoFinishForTests(false)

      requestFocus('sample:rapid-b')
      assertLayerKeysUnique()
      measureKeyboardLayers(renderer)
      act(() => { advanceAnimatedTimingsForTests(0.2) })
      assertLayerKeysUnique()

      requestFocus('sample:rapid-a')
      assertLayerKeysUnique()
      measureKeyboardLayers(renderer)
      act(() => { advanceAnimatedTimingsForTests(0.2) })
      assertLayerKeysUnique()

      requestFocus('sample:rapid-c')
      expect(state?.blockedFieldId).toBe('rapid-c')
      assertLayerKeysUnique()
      measureKeyboardLayers(renderer)
      act(() => { advanceAnimatedTimingsForTests(1) })

      assertLayerKeysUnique()
      expect(keyboardPositionLayers(renderer)).toHaveLength(1)
      expect(duplicateKeyError.mock.calls.filter(([message]) => /same key|duplicate key/i.test(String(message)))).toHaveLength(0)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      duplicateKeyError.mockRestore()
      act(() => { renderer.unmount() })
    }
  })

  it('does not restart an in-flight presentation when pending ownership commits in the same serial', () => {
    let commitPendingFocus: ((fieldId: string) => boolean) | undefined
    const resetSpy = vi.spyOn(Animated.Value.prototype, 'setValue')
    const renderer = mount(
      <InputSurfaceFrame>
        <PendingFocusCommitProbe onReady={value => { commitPendingFocus = value }} />
        <Field fieldId="same-serial" testID="sample:same-serial" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:same-serial')!

    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      measureKeyboardLayers(renderer)
      resetSpy.mockClear()

      act(() => { expect(commitPendingFocus?.('same-serial')).toBe(true) })
      expect(resetSpy.mock.calls.filter(([value]) => value === 0)).toHaveLength(0)
      act(() => { advanceAnimatedTimingsForTests(1) })
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      resetSpy.mockRestore()
      act(() => { renderer.unmount() })
    }
  })

  it('keeps the incoming keyboard instance and passive handler stable across measurement', () => {
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="stable-layer" testID="sample:stable-layer" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:stable-layer')!
    const keyboardNode = () => renderer.root.findAllByType(VirtualKeyboard.type)[0]

    try {
      setAnimatedTimingAutoFinishForTests(false)
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      const beforeMeasure = keyboardNode()
      expect(beforeMeasure).toBeDefined()
      measureKeyboardLayers(renderer)
      const afterMeasure = keyboardNode()
      expect(afterMeasure).toBe(beforeMeasure)
      expect(afterMeasure?.props.onKey).toBe(beforeMeasure?.props.onKey)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('uses one passive noop handler across parent rerenders', () => {
    const renderer = mount(
      <InputSurfaceFrame>
        <PassiveKeyboardHarness />
      </InputSurfaceFrame>,
    )
    const keyboardNode = () => renderer.root.findAllByType(VirtualKeyboard.type)[0]
    const before = keyboardNode()
    const beforeOnKey = before?.props.onKey
    const rerender = renderer.root.findByProps({testID: 'sample:rerender-passive'})
    act(() => { rerender.props.onPress() })
    const after = keyboardNode()
    expect(after?.props.onKey).toBe(beforeOnKey)
    act(() => { renderer.unmount() })
  })

  it('cancels an in-flight handoff from its sampled geometry and removes the overlay only after exit', () => {
    let controller: InputController | undefined
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <ControllerProbe onReady={value => { controller = value }} />
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="cancel-a" testID="sample:cancel-a" layout="alpha" onReady={() => undefined} />
        <Field fieldId="cancel-b" testID="sample:cancel-b" layout="full" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = (testID: string) => renderer.root.findAllByType(TextInput).find(node => node.props.testID === testID)!

    try {
      focusAndFinishKeyboard(renderer, input('sample:cancel-a'))
      setAnimatedTimingAutoFinishForTests(false)
      const target = input('sample:cancel-b')
      act(() => { target.props.onPressIn({stopPropagation: () => undefined}) })
      act(() => { target.props.onFocus({nativeEvent: {}}) })
      measureKeyboardLayers(renderer)
      act(() => { advanceAnimatedTimingsForTests(0.4) })
      act(() => { controller!.dismissActiveField() })

      expect(state?.owner).toBe('none')
      expect(state?.activeFieldId).toBeNull()
      expect(state?.blockedFieldId).toBeNull()
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-hit-shield'})).toHaveLength(1)
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:outgoing-0'}).length).toBeGreaterThan(0)
      act(() => { advanceAnimatedTimingsForTests(0.5) })
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-hit-shield'})).toHaveLength(1)
      act(() => { advanceAnimatedTimingsForTests(1) })
      expect(keyboardPositionLayers(renderer)).toHaveLength(0)
      expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-hit-shield'})).toHaveLength(0)
    } finally {
      setAnimatedTimingAutoFinishForTests(true)
      act(() => { renderer.unmount() })
    }
  })

  it('keeps same-layout focus and Shift changes on one keyboard without a hidden measurement layer', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="stable-a" testID="sample:stable-a" layout="full" onReady={() => undefined} />
        <Field fieldId="stable-b" testID="sample:stable-b" layout="full" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = (testID: string) => renderer.root.findAllByType(TextInput).find(node => node.props.testID === testID)!
    const renderedKeyboardCount = () => renderer.root.findAllByType(View)
      .filter(node => node.props.testID === 'ui.base.input:virtual-keyboard').length

    focusAndFinishKeyboard(renderer, input('sample:stable-a'))
    const target = input('sample:stable-b')
    act(() => { target.props.onPressIn({stopPropagation: () => undefined}) })
    act(() => { target.props.onFocus({nativeEvent: {}}) })
    finishKeyboardPresentation(renderer)
    expect(state?.activeFieldId).toBe('stable-b')
    expect(renderedKeyboardCount()).toBe(1)
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})).toHaveLength(0)

    act(() => { renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:shift'}).props.onPress() })
    expect(state?.shift).toBe(true)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-a'}).props.children).toBe('A')
    expect(renderedKeyboardCount()).toBe(1)
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('keeps the first virtual focus pending until its keyboard has been measured and entered', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="initial-pending" testID="sample:initial-pending" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:initial-pending')!

    try {
      act(() => { input.props.onFocus({nativeEvent: {}}) })
      expect(state?.owner).toBe('none')
      expect(state?.activeFieldId).toBeNull()
      expect(state?.blockedFieldId).toBe('initial-pending')
      expect(state?.blockedCapacity).toBeNull()
      finishKeyboardPresentation(renderer)
      expect(state?.owner).toBe('virtual')
      expect(state?.activeFieldId).toBe('initial-pending')
      expect(state?.visible).toBe(true)
    } finally {
      act(() => { renderer.unmount() })
    }
  })

  it('keeps virtual input local, renders the dock, and captures the typed value', () => {
    let field: InputFieldResult | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="age" testID="sample:age" keyboardKind="virtual" onReady={value => { field = value }} />
      </InputSurfaceFrame>,
    )
    const input = () => renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:age')!

    focusAndFinishKeyboard(renderer, input())
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    const one = renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})
    act(() => { one.props.onPress() })
    expect(input().props.value).toBe('1')
    expect(field?.captureInputSnapshot()).toEqual({
      revision: 1,
      fields: {age: {value: '1', selection: {start: 1, end: 1}}},
    })
    act(() => { renderer.unmount() })
  })

  it('commits virtual keyboard state when a native-less field has no ref', () => {
    let field: InputFieldResult | undefined
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field
          fieldId="native-less"
          testID="sample:native-less"
          nativeLess
          onReady={value => { field = value }}
        />
      </InputSurfaceFrame>,
    )

    expect(field?.inputProps.inputRef).toBeNull()
    act(() => { field?.focus() })
    finishKeyboardPresentation(renderer)
    expect(state?.activeFieldId).toBe('native-less')
    expect(state?.owner).toBe('virtual')
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('exposes the same synchronous snapshot boundary without subscribing to values', () => {
    let capture: (() => ReturnType<ReturnType<typeof useInputSnapshot>>) | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <SnapshotProbe onReady={value => { capture = value }} />
        <Field fieldId="snapshot" testID="sample:snapshot" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:snapshot')!
    focusAndFinishKeyboard(renderer, input)
    const one = renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})
    act(() => { one.props.onPress() })
    expect(capture?.()).toEqual({
      revision: 1,
      fields: {snapshot: {value: '1', selection: {start: 1, end: 1}}},
    })
    act(() => { renderer.unmount() })
  })

  it('keeps the virtual dock as the only keyboard owner across field changes', () => {
    const ready: Record<string, InputFieldResult> = {}
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="virtual" testID="sample:virtual" keyboardKind="virtual" onReady={value => { ready.virtual = value }} />
        <Field fieldId="second" testID="sample:second" keyboardKind="virtual" onReady={value => { ready.second = value }} />
      </InputSurfaceFrame>,
    )
    const input = (testID: string) => renderer.root.findAllByType(TextInput).find(node => node.props.testID === testID)!

    focusAndFinishKeyboard(renderer, input('sample:virtual'))
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    focusAndFinishKeyboard(renderer, input('sample:second'))
    expect(renderer.root.findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')).toHaveLength(1)
    act(() => { renderer.unmount() })
  })

  it('keeps native focus while switching between virtual fields', () => {
    const focusHarness = createNativeFocusHarness()
    const renderer = mountWithNodeMock(
      <InputSurfaceFrame>
        <Field fieldId="owner-virtual" testID="sample:owner-virtual" keyboardKind="virtual" onReady={() => undefined} />
        <Field fieldId="owner-second" testID="sample:owner-second" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
      focusHarness.createNodeMock,
    )

    focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-virtual')
    expect(renderer.root.findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')).toHaveLength(1)
    expect(focusHarness.isFocused('sample:owner-virtual')).toBe(true)

    focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-second')
    expect(renderer.root.findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')).toHaveLength(1)
    expect(focusHarness.isFocused('sample:owner-second')).toBe(true)

    focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-virtual')
    expect(renderer.root.findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')).toHaveLength(1)
    expect(focusHarness.isFocused('sample:owner-virtual')).toBe(true)
    expect(renderer.root.findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')).toHaveLength(1)

    focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-second')
    expect(renderer.root.findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')).toHaveLength(1)
    expect(focusHarness.isFocused('sample:owner-second')).toBe(true)
    act(() => { renderer.unmount() })
  })

  it('preserves the first pointer focus when preflight switches between virtual fields', () => {
    const focusHarness = createNativeFocusHarness()
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mountWithNodeMock(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="owner-first-pointer" testID="sample:owner-first-pointer" keyboardKind="virtual" onReady={() => undefined} />
        <Field fieldId="owner-virtual-pointer" testID="sample:owner-virtual-pointer" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
      focusHarness.createNodeMock,
    )
    const virtualInput = renderer.root.findAllByType(TextInput)
      .find(node => node.props.testID === 'sample:owner-virtual-pointer')!

    focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-first-pointer')
    expect(state?.owner).toBe('virtual')
    const stopPropagation = vi.fn()
    act(() => { virtualInput.props.onPressIn?.({stopPropagation}) })
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-virtual-pointer')
    expect(focusHarness.isFocused('sample:owner-virtual-pointer')).toBe(true)
    expect(state?.activeFieldId).toBe('owner-virtual-pointer')
    expect(state?.owner).toBe('virtual')
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('uses the same preflight before programmatic focus-next across virtual fields', () => {
    const focusHarness = createNativeFocusHarness()
    const ready: Record<string, InputFieldResult> = {}
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mountWithNodeMock(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="complete-owner-first" testID="sample:owner-first-pointer-next" keyboardKind="virtual" onReady={value => { ready.first = value }} />
        <Field fieldId="complete-owner-virtual" testID="sample:owner-virtual-pointer-next" keyboardKind="virtual" onReady={value => { ready.virtual = value }} />
      </InputSurfaceFrame>,
      element => {
        const testID = element.props.testID
        if (testID === 'sample:owner-first-pointer-next' || testID === 'sample:owner-virtual-pointer-next') {
          return focusHarness.createNodeMock(element)
        }
        return {}
      },
    )

    focusNativeHarnessAndFinish(renderer, focusHarness, 'sample:owner-first-pointer-next')
    act(() => { ready.first.complete() })
    finishKeyboardPresentation(renderer)
    expect(focusHarness.isFocused('sample:owner-virtual-pointer-next')).toBe(true)
    expect(state?.activeFieldId).toBe('complete-owner-virtual')
    expect(state?.owner).toBe('virtual')
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })
    vi.restoreAllMocks()
  })

  it('keeps virtual ownership when native blur is only the no-IME side effect', () => {
    let field: InputFieldResult | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <Field
          fieldId="virtual-native-blur"
          testID="sample:virtual-native-blur"
          keyboardKind="virtual"
          onReady={value => { field = value }}
        />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:virtual-native-blur')!
    focusAndFinishKeyboard(renderer, input)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    act(() => { input.props.onBlur() })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    act(() => { field?.blur() })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('dismisses the active keyboard when the surface content is pressed outside an input', () => {
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="outside-dismiss" testID="sample:outside-dismiss" keyboardKind="virtual" onReady={() => undefined} />
        <PrimitiveHeading testID="sample:outside-dismiss:title">标题</PrimitiveHeading>
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:outside-dismiss')!
    focusAndFinishKeyboard(renderer, input)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    const keyboard = renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchEnd?: (event: Readonly<{readonly stopPropagation: () => void}>) => void;
      }>;
    }>
    const stopKeyboardPropagation = vi.fn()
    keyboard.props.onTouchEnd?.({stopPropagation: stopKeyboardPropagation})
    expect(stopKeyboardPropagation).toHaveBeenCalledTimes(1)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    const content = renderer.root.findByProps({testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchStart?: (event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>) => void;
        readonly onTouchEnd?: (event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>) => void;
      }>
    }>
    const stopInputPropagation = vi.fn()
    input.props.onTouchEnd?.({stopPropagation: stopInputPropagation})
    expect(stopInputPropagation).toHaveBeenCalledTimes(1)
    act(() => {
      content.props.onTouchStart?.({nativeEvent: {pageX: 10, pageY: 20}})
      content.props.onTouchEnd?.({nativeEvent: {pageX: 10, pageY: 20}})
    })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('does not let business surface dismissal clear a non-business scoped field', () => {
    let field: InputFieldResult | undefined
    let controller: InputController | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <Field
          fieldId="admin-scoped-field"
          testID="sample:admin-scoped-field"
          nativeLess
          focusScopeId="admin.console"
          onReady={value => { field = value }}
        />
        <ControllerProbe onReady={value => { controller = value }} />
        <PrimitiveHeading testID="sample:admin-scoped-field:title">标题</PrimitiveHeading>
      </InputSurfaceFrame>,
    )

    act(() => {
      controller?.activateFocusScope('admin.console')
      field?.focus()
    })
    finishKeyboardPresentation(renderer)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    const content = renderer.root.findByProps({testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchStart?: (event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>) => void;
        readonly onTouchEnd?: (event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>) => void;
      }>
    }>
    act(() => {
      content.props.onTouchStart?.({nativeEvent: {pageX: 10, pageY: 20}})
      content.props.onTouchEnd?.({nativeEvent: {pageX: 10, pageY: 20}})
    })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    act(() => { field?.blur() })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('keeps the active keyboard during a surface swipe', () => {
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="surface-swipe" testID="sample:surface-swipe" keyboardKind="virtual" onReady={() => undefined} />
        <PrimitiveHeading testID="sample:surface-swipe:title">标题</PrimitiveHeading>
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:surface-swipe')!
    focusAndFinishKeyboard(renderer, input)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    const content = renderer.root.findByProps({testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
      readonly props: Readonly<{
        readonly onTouchStart?: (event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>) => void;
        readonly onTouchEnd?: (event: Readonly<{readonly nativeEvent: Readonly<{readonly pageX: number; readonly pageY: number}>}>) => void;
      }>
    }>
    act(() => {
      content.props.onTouchStart?.({nativeEvent: {pageX: 10, pageY: 20}})
      content.props.onTouchEnd?.({nativeEvent: {pageX: 40, pageY: 20}})
    })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('keeps virtual selection under the native input while text changes', () => {
    let capture: (() => ReturnType<ReturnType<typeof useInputSnapshot>>) | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <SnapshotProbe onReady={value => { capture = value }} />
        <Field fieldId="virtual-selection" testID="sample:virtual-selection" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:virtual-selection')!
    expect(input.props.selection).toEqual({start: 0, end: 0})
    focusAndFinishKeyboard(renderer, input)
    act(() => { input.props.onChangeText('1') })
    act(() => { input.props.onChangeText('12') })
    expect(input.props.value).toBe('12')
    expect(input.props.selection).toEqual({start: 0, end: 0})
    act(() => {
      input.props.onSelectionChange({nativeEvent: {selection: {start: 2, end: 2}}})
    })
    expect(capture?.()).toEqual({
      revision: 1,
      fields: {"virtual-selection": {value: '12', selection: {start: 2, end: 2}}},
    })
    act(() => { renderer.unmount() })
  })

  it('stops an input press from bubbling into surface dismissal', () => {
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="press-boundary" testID="sample:press-boundary" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:press-boundary')!
    const stopPropagation = vi.fn()
    act(() => { input.props.onPressIn?.({stopPropagation}) })
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    act(() => { renderer.unmount() })
  })

  it('stops a web input click from bubbling into surface dismissal', () => {
    const originalDocument = (globalThis as typeof globalThis & {readonly document?: unknown}).document
    Object.defineProperty(globalThis, 'document', {configurable: true, value: {}})
    try {
      const renderer = mount(
        <InputSurfaceFrame>
          <Field fieldId="web-press-boundary" testID="sample:web-press-boundary" keyboardKind="virtual" onReady={() => undefined} />
        </InputSurfaceFrame>,
      )
      const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:web-press-boundary')!
      const stopPropagation = vi.fn()
      act(() => { input.props.onClick?.({stopPropagation}) })
      expect(stopPropagation).toHaveBeenCalledTimes(1)
      act(() => { renderer.unmount() })
    } finally {
      Object.defineProperty(globalThis, 'document', {configurable: true, value: originalDocument})
    }
  })

  it('protects only the pending field from web surface dismissal', () => {
    const originalDocument = (globalThis as typeof globalThis & {readonly document?: unknown}).document
    Object.defineProperty(globalThis, 'document', {configurable: true, value: {}})
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    try {
      const renderer = mount(
        <InputSurfaceFrame>
          <StateProbe onState={value => { state = value }} />
          <Field fieldId="web-pending-target" testID="sample:web-pending-target" keyboardKind="virtual" onReady={() => undefined} />
        </InputSurfaceFrame>,
      )
      const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:web-pending-target')!
      const content = renderer.root.findByProps({testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
        readonly props: Readonly<{readonly onClick?: (event: unknown) => void}>
      }>
      act(() => { input.props.onFocus?.() })
      expect(state?.blockedFieldId).toBe('web-pending-target')
      const pendingTarget = {
        getAttribute: (name: string) => name === 'data-testid' ? 'sample:web-pending-target' : null,
        closest: (selector: string) => selector === 'input,textarea' ? pendingTarget : null,
      }
      act(() => { content.props.onClick?.({nativeEvent: {target: pendingTarget}}) })
      expect(state?.blockedFieldId).toBe('web-pending-target')
      expect(state?.owner).toBe('none')
      act(() => { content.props.onClick?.({nativeEvent: {target: {}}}) })
      expect(state?.blockedFieldId).toBeNull()
      expect(state?.owner).toBe('none')
      act(() => { renderer.unmount() })
    } finally {
      Object.defineProperty(globalThis, 'document', {configurable: true, value: originalDocument})
    }
  })

  it('routes the real complete key to the next field and closes on the final field', () => {
    const firstState: {current: ReturnType<typeof useInputKeyboardState> | null} = {current: null}
    const renderer = mountWithFocusableInputs(
      <InputSurfaceFrame>
        <StateProbe onState={value => { firstState.current = value }} />
        <Field fieldId="complete-first" testID="sample:complete-first" keyboardKind="virtual" onReady={() => undefined} />
        <Field fieldId="complete-second" testID="sample:complete-second" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const first = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:complete-first')!
    focusAndFinishKeyboard(renderer, first)
    expect(firstState.current?.hasNextField).toBe(true)
    act(() => {
      renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'}).props.onPress()
    })
    expect(firstState.current?.activeFieldId).toBe('complete-second')
    expect(firstState.current?.owner).toBe('virtual')
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })

    const finalState: {current: ReturnType<typeof useInputKeyboardState> | null} = {current: null}
    const finalRenderer = mountWithFocusableInputs(
      <InputSurfaceFrame>
        <StateProbe onState={value => { finalState.current = value }} />
        <Field fieldId="complete-final" testID="sample:complete-final" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const final = finalRenderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:complete-final')!
    focusAndFinishKeyboard(finalRenderer, final)
    expect(finalState.current?.hasNextField).toBe(false)
    act(() => {
      finalRenderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'}).props.onPress()
    })
    expect(finalState.current?.activeFieldId).toBeNull()
    expect(finalState.current?.owner).toBe('none')
    expect(finalRenderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { finalRenderer.unmount() })
  })

  it('does not rerender an idle field for a key pressed into another field', () => {
    const renders: Record<string, number> = {}
    const renderer = mount(
      <InputSurfaceFrame>
        <RenderCountingField
          fieldId="active-render-counter"
          testID="sample:active-render-counter"
          keyboardKind="virtual"
          onRender={count => { renders.active = count }}
        />
        <RenderCountingField
          fieldId="idle-render-counter"
          testID="sample:idle-render-counter"
          keyboardKind="virtual"
          onRender={count => { renders.idle = count }}
        />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:active-render-counter')!
    focusAndFinishKeyboard(renderer, input)
    const idleBeforeKey = renders.idle
    const one = renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})
    act(() => { one.props.onPress() })
    expect(renders.idle).toBe(idleBeforeKey)
    expect(renders.active).toBeGreaterThan(idleBeforeKey)
    act(() => { renderer.unmount() })
  })

  it('reports a typed capacity failure while preserving the decision action', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="too-small" testID="sample:too-small" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
      {width: 320, height: 300},
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:too-small')!
    focusAndFinishKeyboard(renderer, input)
    expect(state?.blockedCapacity).toBe('unsupported-width')
    expect(state?.visible).toBe(false)
    expect(renderer.root.findByProps({testID: 'sample:decision'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'ui.base.input:unsupported-size'}).props.children).toContain('至少 360 个逻辑单位')
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('suspends keyboard ownership while a render layer owns focus and releases it on restore', () => {
    let boundary: SurfaceFocusBoundaryListener | undefined
    let field: InputFieldResult | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <BoundaryProbe onReady={value => { boundary = value }} />
        <Field fieldId="age" testID="sample:age-boundary" keyboardKind="virtual" onReady={value => { field = value }} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:age-boundary')!
    focusAndFinishKeyboard(renderer, input)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { boundary?.('suspend') })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { boundary?.('restore'); field?.inputProps.onFocus?.() })
    finishKeyboardPresentation(renderer)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })
  })
})
