import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement} from 'react'
import {TextInput} from 'react-native'
import {describe, expect, it} from 'vitest'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {CommandDispatchResult, Runtime} from '@catering-v2s/kernel-base-runtime'
import {
  createRendererCatalog,
  RenderProvider,
} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame} from '@catering-v2s/ui-base-input'
import type {RenderProviderProps} from '@catering-v2s/ui-base-render'
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state'
import {loginCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  sampleStaffAuthAssembly,
} from '../src/index'
import {AuthSystemNotice} from '../src/components/AuthSystemNotice'
import {StaffLogin} from '../src/components/StaffLogin'
import {
  authNoticeDismissedCommand,
  authSystemFailureDismissedCommand,
  authSystemFailureObservedCommand,
} from '../src/features/commands/commands'
import {operatorNameVariable} from '../src/features/variables/variables'

type RuntimeStateRoot = ReturnType<Runtime['getState']>
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
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(element) })
  const frames = renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'})
  act(() => {
    for (const frame of frames) {
      ;(frame.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frameLayout}})
    }
  })
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
    expect(sampleStaffAuthAssembly.parts.map(part => part.catalogEntry.partKey)).toEqual([
      'sample.auth.login',
      'sample.auth.notice',
      'sample.auth.system-notice',
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
    const [login, notice, systemNotice] = sampleStaffAuthAssembly.parts
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
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(1)
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:shift') })
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:text-a') })
    for (const key of ['0', '0', '1']) {
      act(() => { press(renderer, `ui.base.input:virtual-keyboard:text-${key}`) })
    }

    act(() => { passcode.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(1)
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

  it('renders system notice copy from the operation allowlist', () => {
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
      createElement(AuthSystemNotice, {operation: 'login'}),
    ))

    expectTextValue(renderer, 'sample.auth.system-notice:message', '操作没有完成，请重试')
    act(() => { renderer.unmount() })
  })
})
