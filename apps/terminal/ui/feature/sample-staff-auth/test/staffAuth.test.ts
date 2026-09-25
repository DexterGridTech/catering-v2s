import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement, cloneElement, type ReactElement} from 'react'
import {ScrollView, StyleSheet, TextInput, View} from 'react-native'
import {describe, expect, it} from 'vitest'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort, NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports'
import {createRequestId} from '@catering-v2s/kernel-base-contracts'
import type {CommandDispatchResult, Runtime} from '@catering-v2s/kernel-base-runtime'
import {createDisplayContextModule} from '@catering-v2s/kernel-base-display-context'
import {
  createSampleStaffSessionModule,
  sessionRestoredAnonymousCommand,
} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  createRendererCatalog,
  createRenderRuntimeFacts,
  RenderProvider as ActualRenderProvider,
} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame} from '@catering-v2s/ui-base-input'
import {advanceAnimatedTimingsForTests, setAnimatedTimingAutoFinishForTests} from '../../../../../../tools/terminal-shared/react-native-vitest-entry'
import type {RenderProviderProps} from '@catering-v2s/ui-base-render'
import {createUiCatalog, createUiStateModule, selectLayers} from '@catering-v2s/kernel-base-ui-state'
import {loginCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  sampleStaffAuthAssembly,
} from '../src/index'
import {createSampleStaffAuthModule} from '../src/application/module'
import {createAuthNavigationActor} from '../src/features/actors/actors'
import {AuthSystemNotice} from '../src/components/laptop/AuthSystemNotice'
import {AuthSystemNotice as MobileAuthSystemNotice} from '../src/components/mobile/AuthSystemNotice'
import {StaffLogin} from '../src/components/laptop/StaffLogin'
import {
  authNoticeDismissedCommand,
  authSystemFailureDismissedCommand,
  authSystemFailureObservedCommand,
} from '../src/features/commands/commands'
import {operatorNameVariable} from '../src/features/variables/variables'
import {createTestRuntime} from '../../../../kernel/feature/sample-staff-session/test/support'
import {releaseRuntimeForTest} from '../../../../kernel/base/runtime/src/testing'

type RuntimeStateRoot = ReturnType<Runtime['getState']>
const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
})
const RenderProvider = ActualRenderProvider as unknown as (props: Omit<RenderProviderProps, 'runtimeFacts' | 'nativeLoadingCapability'> & Readonly<{
  readonly runtimeFacts?: RenderProviderProps['runtimeFacts']
}>) => ReactElement | null
type TestInstanceQuery = Readonly<{
  readonly findByProps: (props: Readonly<Record<string, unknown>>) => TestInstanceQuery
  readonly findAllByProps: (props: Readonly<Record<string, unknown>>) => readonly TestInstanceQuery[]
  readonly props: Readonly<Record<string, unknown>>
  readonly children?: readonly unknown[]
}>

type TextInputTestInstance = Readonly<{
  readonly props: Readonly<{
    readonly testID?: unknown
    readonly showSoftInputOnFocus?: unknown
    readonly secureTextEntry?: unknown
    readonly onFocus: (event: Readonly<{readonly nativeEvent: Readonly<Record<string, never>>}>) => void
  }>
}>

type FrameLayout = Readonly<{readonly width: number; readonly height: number}>
type NativeTestElement = Readonly<{readonly type: unknown; readonly props: Readonly<Record<string, unknown>>}>

const createWithNodeMock = create as unknown as (
  element: Parameters<typeof create>[0],
  options: Readonly<{readonly createNodeMock: (element: NativeTestElement) => unknown}>,
) => ReactTestRenderer

const defaultScrollContentByID = new Map<string, object>()
const defaultScrollByFieldID = new Map([
  ['sample.auth.login:operator-name', 'sample.auth.login:scroll'],
  ['sample.auth.login:passcode', 'sample.auth.login:scroll'],
])

const createDefaultInputNodeMock = (frameLayout: FrameLayout) => (element: NativeTestElement): unknown => {
  const testID = element.props.testID
  if (testID === 'ui.base.input:surface-frame') return {}
  if (typeof testID === 'string' && testID.endsWith(':scroll')) {
    const contentNode = {}
    defaultScrollContentByID.set(testID, contentNode)
    return {
      getInnerViewRef: () => contentNode,
      measureLayout: (_relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
        callback(0, 0, frameLayout.width, Math.max(1, frameLayout.height - 20))
      },
      scrollTo: () => undefined,
    }
  }
  if (typeof testID === 'string') {
    const scrollID = defaultScrollByFieldID.get(testID)
    if (scrollID === undefined) return {}
    return {
      measureLayout: (relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
        expect(relativeTo).toBe(defaultScrollContentByID.get(scrollID))
        callback(0, 120, Math.min(320, frameLayout.width), 40)
      },
      focus: () => undefined,
      blur: () => undefined,
    }
  }
  return {}
}

const initializeMountedScrollAreas = (renderer: ReactTestRenderer, frameLayout: FrameLayout): void => {
  const scrollAreas = renderer.root.findAllByProps({}).filter(node =>
    typeof node.props.testID === 'string'
      && (node.props.testID as string).endsWith(':scroll')
      && typeof node.props.onLayout === 'function'
      && typeof node.props.onContentSizeChange === 'function'
      && typeof node.props.onScroll === 'function',
  )
  act(() => {
    for (const scroll of scrollAreas) {
      ;(scroll.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: {
        x: 0,
        y: 0,
        width: frameLayout.width,
        height: Math.max(1, frameLayout.height - 20),
      }}})
      ;(scroll.props.onContentSizeChange as (width: number, height: number) => void)(frameLayout.width, 1200)
      ;(scroll.props.onScroll as (event: unknown) => void)({nativeEvent: {contentOffset: {y: 0}}})
    }
  })
}

const measureKeyboardLayers = (renderer: ReactTestRenderer): void => {
  const measurementLayers = renderer.root.findAllByProps({testID: 'ui.base.input:keyboard-layer-position:measure'}) as unknown as readonly TestInstanceQuery[]
  for (const layer of measurementLayers) {
    const backdrop = layer.findByProps({testID: 'ui.base.input:virtual-keyboard:backdrop'})
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{readonly width: number; readonly height: number}>
    const onLayout = layer.props.onLayout
    if (typeof onLayout !== 'function') throw new Error('Keyboard measurement layer is missing its onLayout callback')
    act(() => {
      ;(onLayout as (event: unknown) => void)({nativeEvent: {layout}})
    })
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

const createLogger = (): LoggerPort => {
  const write = (_input: LogWriteInput): LogWriteResult => ({
    status: 'succeeded',
    value: {} as LogEvent,
    completedAt: 0,
  })
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  }
  return logger
}

const createStateSource = (root: RuntimeStateRoot) => ({
  getStatus: () => 'started' as const,
  getState: () => root,
  subscribe: (_listener: () => void) => () => undefined,
})

const mount = (
  element: ReturnType<typeof createElement>,
  frameLayout: FrameLayout = {width: 1280, height: 800},
  createNodeMock?: (element: NativeTestElement) => unknown,
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  const wrappedElement = cloneElement(element as ReactElement<RenderProviderProps>, {
    runtimeFacts: createRenderRuntimeFacts({
      environmentMode: 'DEV',
      debugMode: {enabled: true, source: 'startup'},
      deviceIdentity: {available: false, deviceId: null},
      platformPortCapabilities: [],
    }),
    nativeLoadingCapability,
  })
  defaultScrollContentByID.clear()
  act(() => {
    renderer = createWithNodeMock(wrappedElement, {
      createNodeMock: createNodeMock ?? createDefaultInputNodeMock(frameLayout),
    })
  })
  const frames = renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'})
  act(() => {
    for (const frame of frames) {
      ;(frame.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frameLayout}})
    }
  })
  if (createNodeMock === undefined) initializeMountedScrollAreas(renderer!, frameLayout)
  return renderer!
}

const withInputSurface = (element: ReturnType<typeof createElement>) => createElement(
  InputSurfaceFrame,
  {},
  element,
)

const findTextInput = (renderer: ReactTestRenderer, testID: string): TextInputTestInstance => {
  const input = (renderer.root as unknown as Readonly<{
    readonly findAllByType: (type: unknown) => readonly TextInputTestInstance[]
  }>).findAllByType(TextInput).find(node => node.props.testID === testID)
  if (input === undefined) throw new Error(`Missing TextInput ${testID}`)
  return input
}

const press = (renderer: ReactTestRenderer, testID: string): unknown => {
  const instance = renderer.root.findByProps({testID}) as unknown as Readonly<{
    readonly props: Readonly<{readonly onPress: () => unknown}>
  }>
  return instance.props.onPress()
}

const virtualKeyboardHosts = (renderer: ReactTestRenderer): readonly TestInstanceQuery[] =>
  (renderer.root as unknown as Readonly<{
    readonly findAllByType: (type: unknown) => readonly TestInstanceQuery[]
  }>).findAllByType(View).filter(node => node.props.testID === 'ui.base.input:virtual-keyboard')

const completedResult = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'command_test' as never,
  status: 'completed',
  actorResults: [],
})

const systemFailureResult = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'command_test' as never,
  status: 'error',
  actorResults: [{
    actorKey: 'sample-test-actor',
    status: 'error',
    startedAt: 0,
    completedAt: 1,
    result: null,
    error: {
      key: 'sample-test-error',
      code: 'ERR_SAMPLE_TEST',
      message: 'test failure',
      category: 'SYSTEM',
      severity: 'HIGH',
    },
  }],
})

const expectTextValue = (renderer: ReactTestRenderer, testID: string, value: string): void => {
  expect(renderer.root.findAllByProps({testID}).some(node =>
    node.children?.filter((child): child is string => typeof child === 'string').join('').includes(value) ?? false,
  )).toBe(true)
}

describe('sample staff auth UI feature', () => {
  it('exports one assembly description with the approved parts and variables', () => {
    const expectedPair = (part: Readonly<{
      readonly partKey: string
      readonly containerKeys: readonly string[]
      readonly displayModes: readonly string[]
      readonly workspaces: readonly string[]
      readonly instanceModes: readonly string[]
      readonly title: string
      readonly layerTier: 'standard' | 'alert'
      readonly layerGuard: 'dismissible' | 'decisive'
    }>) => (['laptop', 'mobile'] as const).map(surfaceForm => ({
      ...part,
      rendererKey: `${part.partKey}.${surfaceForm}`,
      surfaceForm: [surfaceForm],
    }))
    const metadata = sampleStaffAuthAssembly.parts.map(({catalogEntry, rendererBinding}) => ({
      partKey: catalogEntry.partKey,
      rendererKey: catalogEntry.rendererKey,
      containerKeys: [...catalogEntry.containerKeys],
      displayModes: [...catalogEntry.displayModes],
      workspaces: [...catalogEntry.workspaces],
      instanceModes: [...catalogEntry.instanceModes],
      title: catalogEntry.title,
      surfaceForm: [...catalogEntry.surfaceForm],
      layerTier: rendererBinding.layerTier,
      layerGuard: rendererBinding.layerGuard,
    }))
    expect(metadata).toEqual([
      ...expectedPair({partKey: 'sample.auth.login', containerKeys: ['main'], displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'], title: '店员登录', layerTier: 'standard', layerGuard: 'dismissible'}),
      ...expectedPair({partKey: 'sample.auth.notice', containerKeys: [], displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'], title: '登录失败提示', layerTier: 'alert', layerGuard: 'dismissible'}),
      ...expectedPair({partKey: 'sample.auth.system-notice', containerKeys: [], displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'], title: '系统失败提示', layerTier: 'alert', layerGuard: 'dismissible'}),
    ])
    expect(sampleStaffAuthAssembly.variables).toEqual([
      operatorNameVariable,
    ])
    expect(sampleStaffAuthAssembly.variables.map(variable => [variable.key, variable.persistIntent])).toEqual([
      ['sample.login.operator-name', 'owner-only'],
    ])
    expect(sampleStaffAuthAssembly.createModule().commands).toEqual([{
      name: authNoticeDismissedCommand.commandName,
      visibility: 'public',
    }, {
      name: authSystemFailureObservedCommand.commandName,
      visibility: 'public',
    }, {
      name: authSystemFailureDismissedCommand.commandName,
      visibility: 'public',
    }])
  })

  it('keeps the notice layer-only and the login screen on PRIMARY', () => {
    const login = sampleStaffAuthAssembly.parts.find(part => part.catalogEntry.rendererKey === 'sample.auth.login.laptop')
    const notice = sampleStaffAuthAssembly.parts.find(part => part.catalogEntry.rendererKey === 'sample.auth.notice.laptop')
    const systemNotice = sampleStaffAuthAssembly.parts.find(part => part.catalogEntry.rendererKey === 'sample.auth.system-notice.laptop')
    expect(login?.catalogEntry).toMatchObject({
      partKey: 'sample.auth.login',
      containerKeys: ['main'],
      displayModes: ['PRIMARY'],
    })
    expect(notice?.catalogEntry).toMatchObject({
      partKey: 'sample.auth.notice',
      containerKeys: [],
      displayModes: ['PRIMARY'],
    })
    expect(notice?.rendererBinding.layerTier).toBe('alert')
    expect(systemNotice?.catalogEntry).toMatchObject({
      partKey: 'sample.auth.system-notice',
      containerKeys: [],
      displayModes: ['PRIMARY'],
    })
    expect(systemNotice?.rendererBinding.layerTier).toBe('alert')
  })

  it('uses the virtual keyboard for both credential fields and submits their current snapshot', async () => {
    const dispatched: Array<Readonly<{readonly commandName: string; readonly payload: unknown}>> = []
    const dispatchCommand = (async command => {
      dispatched.push({commandName: command.definition.commandName, payload: command.payload})
      return completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource({} as RuntimeStateRoot),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: createLogger(),
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(StaffLogin)),
    ))

    const operatorName = findTextInput(renderer, 'sample.auth.login:operator-name')
    const passcode = findTextInput(renderer, 'sample.auth.login:passcode')
    expect(operatorName.props.showSoftInputOnFocus).toBe(false)
    expect(passcode.props.showSoftInputOnFocus).toBe(false)
    expect(passcode.props.secureTextEntry).toBe(true)

    act(() => { operatorName.props.onFocus({nativeEvent: {}}) })
    finishKeyboardPresentation(renderer)
    expect(virtualKeyboardHosts(renderer)).toHaveLength(1)
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:shift') })
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:text-a') })
    for (const key of ['0', '0', '1']) {
      act(() => { press(renderer, `ui.base.input:virtual-keyboard:text-${key}`) })
    }

    act(() => { passcode.props.onFocus({nativeEvent: {}}) })
    finishKeyboardPresentation(renderer)
    expect(virtualKeyboardHosts(renderer)).toHaveLength(1)
    for (const _ of [1, 2, 3, 4]) {
      act(() => { press(renderer, 'ui.base.input:virtual-keyboard:text-1') })
    }

    const submit = renderer.root.findByProps({testID: 'sample.auth.login:submit'})
    await act(async () => { await (submit.props.onPress as () => Promise<unknown>)() })
    expect(dispatched[0]).toEqual({
      commandName: loginCommand.commandName,
      payload: {operatorName: 'A001', passcode: '1111'},
    })
    act(() => { renderer.unmount() })
  })

  it('measures both credential fields relative to the actual scroll content node', () => {
    const surfaceRoot = {}
    const scrollContent = {}
    const measuredFields: Array<Readonly<{readonly fieldId: string; readonly relativeTo: unknown}>> = []
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource({} as RuntimeStateRoot),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: createLogger(),
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(StaffLogin)),
    ), {width: 1280, height: 800}, element => {
      if (element.type === View && element.props.testID === 'ui.base.input:surface-frame') return surfaceRoot
      if (element.type === ScrollView && element.props.testID === 'sample.auth.login:scroll') {
        return {
          getInnerViewRef: () => scrollContent,
          measureLayout: (relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
            expect(relativeTo).toBe(surfaceRoot)
            callback(0, 0, 1280, 780)
          },
          scrollTo: () => undefined,
        }
      }
      const fieldId = element.props.testID
      if (fieldId === 'sample.auth.login:operator-name' || fieldId === 'sample.auth.login:passcode') {
        return {
          measureLayout: (relativeTo: unknown, callback: (x: number, y: number, width: number, height: number) => void) => {
            measuredFields.push({fieldId, relativeTo})
            expect(relativeTo).toBe(scrollContent)
            callback(0, 500, 320, 40)
          },
          focus: () => undefined,
          blur: () => undefined,
        }
      }
      return {}
    })

    const scrollProps = renderer.root.findAllByProps({testID: 'sample.auth.login:scroll'})
      .find(node => typeof node.props.onLayout === 'function'
        && typeof node.props.onContentSizeChange === 'function'
        && typeof node.props.onScroll === 'function')?.props
    if (scrollProps === undefined) throw new Error('Missing native scroll view callbacks')
    act(() => {
      ;(scrollProps.onLayout as (event: unknown) => void)({nativeEvent: {layout: {x: 0, y: 0, width: 1280, height: 780}}})
      ;(scrollProps.onContentSizeChange as (width: number, height: number) => void)(1280, 1100)
      ;(scrollProps.onScroll as (event: unknown) => void)({nativeEvent: {contentOffset: {y: 0}}})
    })
    for (const fieldId of ['sample.auth.login:operator-name', 'sample.auth.login:passcode']) {
      act(() => { findTextInput(renderer, fieldId).props.onFocus({nativeEvent: {}}) })
      finishKeyboardPresentation(renderer)
    }
    expect([...new Set(measuredFields.map(field => field.fieldId))]).toEqual([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
    ])
    expect(measuredFields.every(field => field.relativeTo === scrollContent)).toBe(true)
    act(() => { renderer.unmount() })
  })

  it.each([
    ['landscape PRIMARY', {width: 1280, height: 800}],
    ['portrait PRIMARY', {width: 360, height: 720}],
  ] as const)('keeps the full credential keyboard available in the %s frame', (_label, frameLayout) => {
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource({} as RuntimeStateRoot),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: createLogger(),
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(StaffLogin)),
    ), frameLayout)

    const operatorName = findTextInput(renderer, 'sample.auth.login:operator-name')
    act(() => { operatorName.props.onFocus({nativeEvent: {}}) })
    finishKeyboardPresentation(renderer)
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-a'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('observes a resolved system failure after clearing the tracked login request', async () => {
    const commandNames: string[] = []
    const dispatchCommand = (async command => {
      commandNames.push(command.definition.commandName)
      return commandNames.length === 1 ? systemFailureResult() : completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource({} as RuntimeStateRoot),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: createLogger(),
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(StaffLogin)),
    ))

    const scrollArea = renderer.root.findByProps({testID: 'sample.auth.login:scroll'}) as unknown as TestInstanceQuery
    expect(scrollArea.findAllByProps({testID: 'sample.auth.login:submit'})).toHaveLength(0)
    const submit = renderer.root.findByProps({testID: 'sample.auth.login:submit'})
    await act(async () => { await (submit.props.onPress as () => Promise<unknown>)() })
    expect(commandNames).toEqual([
      loginCommand.commandName,
      authSystemFailureObservedCommand.commandName,
    ])
    act(() => { renderer.unmount() })
  })

  it('renders both system-notice profiles with fixed copy and shared semantics', () => {
    for (const [Component, isMobile] of [[AuthSystemNotice, false], [MobileAuthSystemNotice, true]] as const) {
      const renderer = mount(createElement(
        RenderProvider,
        {
          stateSource: createStateSource({} as RuntimeStateRoot),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger: createLogger(),
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(Component, {operation: 'login'}),
      ))

      expectTextValue(renderer, 'sample.auth.system-notice:message', '操作没有完成，请重试')
      expect(renderer.root.findAllByProps({testID: 'sample.auth.system-notice'}).map(node => node.props.style))
        .toContainEqual(isMobile ? {flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'} : {flex: 1, minHeight: 0, padding: 24})
      expect(renderer.root.findAllByProps({testID: 'sample.auth.system-notice:card'}).map(node => node.props.style))
        .toContainEqual(isMobile ? {width: '100%'} : {width: '100%', maxWidth: 720})
      expect(renderer.root.findAllByProps({testID: 'sample.auth.system-notice:actions'}).map(node => node.props.className))
        .toContain(isMobile ? 'w-full items-center gap-3' : 'flex-row flex-wrap items-start gap-3')
      expect(renderer.root.findAllByProps({testID: 'sample.auth.system-notice:dismiss'}).map(node => node.props.style))
        .toContainEqual(isMobile ? {width: '100%'} : undefined)
      act(() => { renderer.unmount() })
    }
  })

  it('dispatches the staff-auth-owned command when dismissing a system failure', async () => {
    const commandNames: string[] = []
    const dispatchCommand = (async command => {
      commandNames.push(command.definition.commandName)
      return completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource({} as RuntimeStateRoot),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger: createLogger(),
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(AuthSystemNotice, {operation: 'login'}),
    ))

    await act(async () => { await press(renderer, 'sample.auth.system-notice:dismiss') })
    expect(commandNames).toEqual([authSystemFailureDismissedCommand.commandName])
    act(() => { renderer.unmount() })
  })

  it('treats a repeated system failure observation as an idempotent existing notice', async () => {
    const catalog = createUiCatalog(sampleStaffAuthAssembly.parts
      .filter(part => part.catalogEntry.surfaceForm.includes('mobile'))
      .map(part => part.catalogEntry))
    const loggerEvents: LogEvent[] = []
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createUiStateModule({catalog, variables: sampleStaffAuthAssembly.variables, surfaceForm: 'mobile'}),
      createSampleStaffSessionModule(),
      createSampleStaffAuthModule(),
    ], undefined, undefined, loggerEvents)
    try {
      await runtime.start()
      const first = await runtime.dispatchCommand(authSystemFailureObservedCommand, {operation: 'login'}, {requestId: createRequestId()})
      const second = await runtime.dispatchCommand(authSystemFailureObservedCommand, {operation: 'login'}, {requestId: createRequestId()})
      expect(first.status).toBe('completed')
      expect(second.status).toBe('completed')
      expect(selectLayers(runtime.getState(), 'PRIMARY')).toEqual([
        expect.objectContaining({
          layerId: 'sample.auth.system-notice',
          partKey: 'sample.auth.system-notice',
          persistence: 'ephemeral',
        }),
      ])
      expect(loggerEvents.some(event => event.event === 'ui-state.layer.duplicate-rejected')).toBe(false)
      expect(runtime.journal.list().some(event =>
        event.kind === 'command.completed' && event.status === 'error' && event.commandName === 'kernel.base.ui-state.open-layer',
      )).toBe(false)
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })

  it('does not issue local content writes when a SLAVE is rendering its projected MAIN workspace', async () => {
    const actor = createAuthNavigationActor()
    const handler = actor.handlers.find(handler => handler.commandName === sessionRestoredAnonymousCommand.commandName)
    expect(handler).toBeDefined()
    const dispatches: string[] = []
    const state = {
      'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      'kernel.base.display-context.display-role': {displayRole: 'VICE', powerConfirmation: null},
    } as RuntimeStateRoot
    await handler!.handle({
      command: {commandName: sessionRestoredAnonymousCommand.commandName, payload: {}},
      getState: () => state,
      dispatchCommand: async (definition: {readonly commandName: string}) => {
        dispatches.push(definition.commandName)
        return completedResult()
      },
    } as never)
    expect(dispatches).toEqual([])
  })
})
