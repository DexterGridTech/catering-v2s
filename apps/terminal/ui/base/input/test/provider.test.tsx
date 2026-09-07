import {act, create, type ReactTestInstance, type ReactTestRenderer} from 'react-test-renderer'
import {PrimitiveButton, PrimitiveHeading, PrimitiveInput} from '@catering-v2s/ui-base-primitives'
import {useSurfaceFocusBoundary, type SurfaceFocusBoundaryListener} from '@catering-v2s/ui-base-render'
import {describe, expect, it, vi} from 'vitest'
import {InputSurfaceFrame} from '../src/components/InputSurfaceFrame'
import {useInputField} from '../src/hooks/useInputField'
import {useInputSnapshot} from '../src/hooks/useInputSnapshot'
import {useInputKeyboardState} from '../src/contexts/context'
import type {InputFieldResult} from '../src/types/types'
import {Keyboard, TextInput} from 'react-native'
import {useRef} from 'react'

const applyLayout = (renderer: ReactTestRenderer, width = 962, height = 541): void => {
  act(() => {
    renderer.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
      nativeEvent: {layout: {width, height}},
    })
  })
}

const mount = (
  element: Parameters<typeof create>[0],
  size: Readonly<{readonly width: number; readonly height: number}> = {width: 962, height: 541},
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
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
}>

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
    if (typeof testID !== 'string' || !testID.startsWith('sample:owner-')) return {}

    const node: NativeInputMock = {
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
  if (typeof element.props.testID !== 'string' || !element.props.testID.startsWith('sample:complete-')) return {}
  return {
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
  keyboardKind,
  onReady,
}: Readonly<{
  readonly fieldId: string
  readonly testID: string
  readonly keyboardKind: 'system' | 'virtual'
  readonly onReady: (result: InputFieldResult) => void
}>) => {
  const result = useInputField(
    keyboardKind === 'virtual'
      ? {
          fieldId,
          testID,
          accessibilityLabel: fieldId,
          keyboardKind: 'virtual',
          layout: 'numeric',
        }
      : {
          fieldId,
          testID,
          accessibilityLabel: fieldId,
          keyboardKind: 'system',
        },
  )
  onReady(result)
  return <PrimitiveInput {...result.inputProps} />
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
  keyboardKind,
  onRender,
}: Readonly<{
  readonly fieldId: string
  readonly testID: string
  readonly keyboardKind: 'system' | 'virtual'
  readonly onRender: (count: number) => void
}>) => {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  onRender(renderCountRef.current)
  const result = useInputField(
    keyboardKind === 'virtual'
      ? {
          fieldId,
          testID,
          accessibilityLabel: fieldId,
          keyboardKind: 'virtual',
          layout: 'numeric',
        }
      : {
          fieldId,
          testID,
          accessibilityLabel: fieldId,
          keyboardKind: 'system',
        },
  )
  return <PrimitiveInput {...result.inputProps} />
}

const StateProbe = ({onState}: Readonly<{readonly onState: (state: ReturnType<typeof useInputKeyboardState>) => void}>) => {
  onState(useInputKeyboardState())
  return <PrimitiveButton testID="sample:decision" onPress={() => undefined}>继续</PrimitiveButton>
}

describe('input provider', () => {
  it('does not render or commit a virtual keyboard before the frame is measured', () => {
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        <InputSurfaceFrame>
          <StateProbe onState={value => { state = value }} />
          <Field fieldId="unmeasured" testID="sample:unmeasured" keyboardKind="virtual" onReady={() => undefined} />
        </InputSurfaceFrame>,
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
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    expect(state?.activeFieldId).toBe('unmeasured')
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer!.unmount() })
  })

  it('clears a virtual owner when a resize makes the active layout infeasible', () => {
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(
        <InputSurfaceFrame>
          <Field fieldId="resized" testID="sample:resized" keyboardKind="virtual" onReady={() => undefined} />
        </InputSurfaceFrame>,
      )
    })
    applyLayout(renderer!, 962, 541)
    const input = renderer!.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:resized')!
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    expect(renderer!.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    applyLayout(renderer!, 360, 300)
    expect(renderer!.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    expect(renderer!.root.findByProps({testID: 'ui.base.input:unsupported-size'})).toBeDefined()
    act(() => { renderer!.unmount() })
  })

  it('keeps virtual input local, renders the dock, and captures the typed value', () => {
    let field: InputFieldResult | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="age" testID="sample:age" keyboardKind="virtual" onReady={value => { field = value }} />
      </InputSurfaceFrame>,
    )
    const input = () => renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:age')!

    act(() => { input().props.onFocus({nativeEvent: {}}) })
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

  it('exposes the same synchronous snapshot boundary without subscribing to values', () => {
    let capture: (() => ReturnType<ReturnType<typeof useInputSnapshot>>) | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <SnapshotProbe onReady={value => { capture = value }} />
        <Field fieldId="snapshot" testID="sample:snapshot" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:snapshot')!
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    const one = renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})
    act(() => { one.props.onPress() })
    expect(capture?.()).toEqual({
      revision: 1,
      fields: {snapshot: {value: '1', selection: {start: 1, end: 1}}},
    })
    act(() => { renderer.unmount() })
  })

  it('switches from virtual to system without leaving the virtual dock visible', () => {
    const ready: Record<string, InputFieldResult> = {}
    const renderer = mount(
      <InputSurfaceFrame>
        <Field fieldId="virtual" testID="sample:virtual" keyboardKind="virtual" onReady={value => { ready.virtual = value }} />
        <Field fieldId="system" testID="sample:system" keyboardKind="system" onReady={value => { ready.system = value }} />
      </InputSurfaceFrame>,
    )
    const input = (testID: string) => renderer.root.findAllByType(TextInput).find(node => node.props.testID === testID)!

    act(() => { input('sample:virtual').props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { input('sample:system').props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    expect(input('sample:system').props.showSoftInputOnFocus).toBe(true)
    act(() => { renderer.unmount() })
  })

  it('keeps native focus while switching keyboard owners in both directions', () => {
    const focusHarness = createNativeFocusHarness()
    const dismiss = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {
      focusHarness.blurActive()
    })
    const renderer = mountWithNodeMock(
      <InputSurfaceFrame>
        <Field fieldId="owner-virtual" testID="sample:owner-virtual" keyboardKind="virtual" onReady={() => undefined} />
        <Field fieldId="owner-system" testID="sample:owner-system" keyboardKind="system" onReady={() => undefined} />
      </InputSurfaceFrame>,
      focusHarness.createNodeMock,
    )

    act(() => { focusHarness.focus('sample:owner-virtual') })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(1)
    expect(focusHarness.isFocused('sample:owner-virtual')).toBe(true)

    act(() => { focusHarness.focus('sample:owner-system') })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    expect(focusHarness.isFocused('sample:owner-system')).toBe(true)
    expect(dismiss).toHaveBeenCalledTimes(0)

    act(() => { focusHarness.focus('sample:owner-virtual') })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(1)
    expect(focusHarness.isFocused('sample:owner-virtual')).toBe(true)
    expect(dismiss).toHaveBeenCalledTimes(1)

    act(() => { focusHarness.focus('sample:owner-system') })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    expect(focusHarness.isFocused('sample:owner-system')).toBe(true)
    expect(dismiss).toHaveBeenCalledTimes(1)
    act(() => { renderer.unmount() })
    dismiss.mockRestore()
  })

  it('preserves the first pointer focus when preflight switches system to virtual', () => {
    const focusHarness = createNativeFocusHarness()
    const dismiss = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {
      focusHarness.blurActive()
    })
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mountWithNodeMock(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="owner-system-pointer" testID="sample:owner-system-pointer" keyboardKind="system" onReady={() => undefined} />
        <Field fieldId="owner-virtual-pointer" testID="sample:owner-virtual-pointer" keyboardKind="virtual" onReady={() => undefined} />
      </InputSurfaceFrame>,
      focusHarness.createNodeMock,
    )
    const virtualInput = renderer.root.findAllByType(TextInput)
      .find(node => node.props.testID === 'sample:owner-virtual-pointer')!

    act(() => { focusHarness.focus('sample:owner-system-pointer') })
    expect(state?.owner).toBe('system')
    const stopPropagation = vi.fn()
    act(() => { virtualInput.props.onPressIn?.({stopPropagation}) })
    expect(stopPropagation).toHaveBeenCalledTimes(1)
    act(() => { focusHarness.focus('sample:owner-virtual-pointer') })
    expect(focusHarness.isFocused('sample:owner-virtual-pointer')).toBe(true)
    expect(state?.activeFieldId).toBe('owner-virtual-pointer')
    expect(state?.owner).toBe('virtual')
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })
    dismiss.mockRestore()
  })

  it('uses the same preflight before programmatic focus-next crosses owners', () => {
    const focusHarness = createNativeFocusHarness()
    vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {
      focusHarness.blurActive()
    })
    const ready: Record<string, InputFieldResult> = {}
    let state: ReturnType<typeof useInputKeyboardState> | undefined
    const renderer = mountWithNodeMock(
      <InputSurfaceFrame>
        <StateProbe onState={value => { state = value }} />
        <Field fieldId="complete-owner-system" testID="sample:owner-system-pointer-next" keyboardKind="system" onReady={value => { ready.system = value }} />
        <Field fieldId="complete-owner-virtual" testID="sample:owner-virtual-pointer-next" keyboardKind="virtual" onReady={value => { ready.virtual = value }} />
      </InputSurfaceFrame>,
      element => {
        const testID = element.props.testID
        if (testID === 'sample:owner-system-pointer-next' || testID === 'sample:owner-virtual-pointer-next') {
          return focusHarness.createNodeMock(element)
        }
        return {}
      },
    )

    act(() => { focusHarness.focus('sample:owner-system-pointer-next') })
    act(() => { ready.system.complete() })
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
    act(() => { input.props.onFocus({nativeEvent: {}}) })
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
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()

    const content = renderer.root.findByProps({testID: 'ui.base.input:surface-content'}) as unknown as Readonly<{
      readonly props: Readonly<{readonly onPress?: () => void}>
    }>
    act(() => { content.props.onPress?.() })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('leaves system keyboard selection under the native input while text changes', () => {
    let capture: (() => ReturnType<ReturnType<typeof useInputSnapshot>>) | undefined
    const renderer = mount(
      <InputSurfaceFrame>
        <SnapshotProbe onReady={value => { capture = value }} />
        <Field fieldId="system-selection" testID="sample:system-selection" keyboardKind="system" onReady={() => undefined} />
      </InputSurfaceFrame>,
    )
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'sample:system-selection')!
    expect(input.props.selection).toBeUndefined()
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    act(() => { input.props.onChangeText('1') })
    act(() => { input.props.onChangeText('12') })
    expect(input.props.value).toBe('12')
    expect(input.props.selection).toBeUndefined()
    act(() => {
      input.props.onSelectionChange({nativeEvent: {selection: {start: 2, end: 2}}})
    })
    expect(capture?.()).toEqual({
      revision: 1,
      fields: {"system-selection": {value: '12', selection: {start: 2, end: 2}}},
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
    input.props.onPressIn?.({stopPropagation})
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
      input.props.onClick?.({stopPropagation})
      expect(stopPropagation).toHaveBeenCalledTimes(1)
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
    act(() => { first.props.onFocus({nativeEvent: {}}) })
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
    act(() => { final.props.onFocus({nativeEvent: {}}) })
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
    act(() => { input.props.onFocus({nativeEvent: {}}) })
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
    act(() => { input.props.onFocus({nativeEvent: {}}) })
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
    act(() => { input.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { boundary?.('suspend') })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    act(() => { boundary?.('restore'); field?.inputProps.onFocus?.() })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => { renderer.unmount() })
  })
})
