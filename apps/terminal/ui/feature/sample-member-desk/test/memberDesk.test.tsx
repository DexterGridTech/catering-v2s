import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {createElement, cloneElement, type ReactElement} from 'react'
import {TextInput} from 'react-native'
import {describe, expect, it} from 'vitest'
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort, NativeLoadingCapability} from '@catering-v2s/ui-base-test-support'
import {createRequestId, type TopologyLocator} from '@catering-v2s/kernel-base-contracts'
import type {CommandDispatchResult, Runtime} from '@catering-v2s/kernel-base-runtime'
import {createDisplayContextModule} from '@catering-v2s/kernel-base-display-context'
import {createTransportModule} from '@catering-v2s/kernel-base-transport'
import {createTopologyModule, topologyActions, topologyHostEventCommand} from '@catering-v2s/kernel-base-topology'
import {
  createSampleStaffSessionModule,
} from '@catering-v2s/kernel-feature-sample-staff-session'
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry'
import {loginSucceededCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {
  createRendererCatalog,
  createRenderRuntimeFacts,
  RenderProvider as ActualRenderProvider,
} from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame} from '@catering-v2s/ui-base-input'
import type {RenderProviderProps} from '@catering-v2s/ui-base-render'
import {createUiCatalog, createUiStateModule, selectLayers, selectScreen} from '@catering-v2s/kernel-base-ui-state'
import {sampleMemberDeskAssembly} from '../src/index'
import {createSampleMemberDeskModule} from '../src/application/module'
import {CustomerMember} from '../src/components/CustomerMember'
import {DeskSystemNotice} from '../src/components/DeskSystemNotice'
import {MemberList} from '../src/components/MemberList'
import {MemberForm} from '../src/components/MemberForm'
import {RegistryNotice} from '../src/components/RegistryNotice'
import {WaitingConfirm} from '../src/components/WaitingConfirm'
import {
  confirmMemberCommand,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {memberActions as memberStateActions} from '../../../../kernel/feature/sample-member-registry/src/features/slices/slice'
import {deskSystemFailureObservedCommand} from '../src/features/commands/commands'
import {createTestRuntime} from '../../../../kernel/feature/sample-member-registry/test/support'
import {releaseRuntimeForTest} from '../../../../kernel/base/runtime/src/testing'
import {setDisplayRoleAction} from '../../../../kernel/base/display-context/src/features/slices/displayRole'
import {setRuntimeInstanceModeAction} from '../../../../kernel/base/runtime/src/features/slices/runtimeInstanceMode'

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
}>

type TextInputTestInstance = Readonly<{
  readonly props: Readonly<{
    readonly testID?: unknown
    readonly maxLength?: unknown
    readonly value?: unknown
    readonly onFocus: (event: Readonly<{readonly nativeEvent: Readonly<Record<string, never>>}>) => void
    readonly onChangeText: (value: string) => void
  }>
}>

type FrameLayout = Readonly<{readonly width: number; readonly height: number}>

const findTextInput = (renderer: ReactTestRenderer, testID: string): TextInputTestInstance => {
  const root = renderer.root as unknown as Readonly<{
    readonly findAllByType: (type: unknown) => readonly TextInputTestInstance[]
  }>
  const input = root.findAllByType(TextInput).find(node => node.props.testID === testID)
  if (input === undefined) throw new Error(`Missing TextInput ${testID}`)
  return input
}

const press = (renderer: ReactTestRenderer, testID: string): (() => unknown) => {
  const instance = renderer.root.findByProps({testID}) as unknown as Readonly<{
    readonly props: Readonly<{readonly onPress: () => unknown}>
  }>
  return instance.props.onPress
}

const createLogger = (): Readonly<{readonly logger: LoggerPort; readonly events: LogWriteInput[]}> => {
  const events: LogWriteInput[] = []
  const write = (input: LogWriteInput): LogWriteResult => {
    events.push(input)
    return {status: 'succeeded', value: {} as LogEvent, completedAt: 0}
  }
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  }
  return {logger, events}
}

const createStateSource = (root: RuntimeStateRoot) => ({
  getStatus: () => 'started' as const,
  getState: () => root,
  subscribe: (_listener: () => void) => () => undefined,
})

const mount = (
  element: ReturnType<typeof createElement>,
  frameLayout: FrameLayout = {width: 960, height: 540},
): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(cloneElement(element as ReactElement<RenderProviderProps>, {
      runtimeFacts: createRenderRuntimeFacts({
        environmentMode: 'DEV',
        debugMode: {enabled: true, source: 'startup'},
        deviceIdentity: {available: false, deviceId: null},
        platformPortCapabilities: [],
      }),
      nativeLoadingCapability,
    }))
  })
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

const expectTextValue = (renderer: ReactTestRenderer, testID: string, value: string): void => {
  expect(renderer.root.findAllByProps({testID}).some(node =>
    node.children?.filter((child): child is string => typeof child === 'string').join('').includes(value) ?? false,
  )).toBe(true)
}

const expectTextAbsent = (renderer: ReactTestRenderer, value: string): void => {
  expect(renderer.root.findAllByProps({testID: 'sample.desk.system-notice:message'}).some(node =>
    node.children?.filter((child): child is string => typeof child === 'string').join('').includes(value) ?? false,
  )).toBe(false)
}

const memberRoot = (
  pending: Readonly<{name: string; phone: string}>,
  members: readonly Readonly<{memberId: string; name: string; phone: string; registeredAt: number}>[] = [],
): RuntimeStateRoot => Object.freeze({
  'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'MASTER'}),
  'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
  'kernel.feature.sample-member-registry.members': Object.freeze({
    members: Object.freeze(members),
    pending: Object.freeze(pending),
  }),
}) as RuntimeStateRoot

const completedResult = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'command_test' as never,
  status: 'completed',
  actorResults: [],
})

const resultWithActors = (
  status: CommandDispatchResult['status'],
  actorResults: readonly object[],
): CommandDispatchResult => ({
  requestId: null,
  commandId: 'command_test' as never,
  status,
  actorResults: actorResults as CommandDispatchResult['actorResults'],
})

const actorFailure = (category: 'SYSTEM' | 'BUSINESS'): object => ({
  actorKey: 'sample-test-actor',
  status: 'error',
  startedAt: 0,
  completedAt: 1,
  result: null,
  error: {
    key: 'sample-test-error',
    code: 'ERR_SAMPLE_TEST',
    message: 'test failure',
    category,
    severity: 'error',
  },
})

const runningActor = (): object => ({
  actorKey: 'sample-test-actor',
  status: 'running',
  startedAt: 0,
  completedAt: null,
  result: null,
  error: null,
})

describe('sample member desk UI feature', () => {
  it('exports one assembly description with nine exact parts and no transient variables', () => {
    expect(sampleMemberDeskAssembly.parts.map(part => part.catalogEntry.partKey)).toEqual([
      'sample.desk.member-list',
      'sample.desk.member-form',
      'sample.desk.waiting-confirm',
      'sample.desk.registry-notice',
      'sample.desk.discard-confirm',
      'sample.desk.withdraw-confirm',
      'sample.desk.system-notice',
      'sample.desk.customer-welcome',
      'sample.desk.customer-member',
    ])
    expect(sampleMemberDeskAssembly).not.toHaveProperty('variables')
  })

  it('uses the topology secondary fact for member navigation on a paired single-screen master', async () => {
    const catalog = createUiCatalog(sampleMemberDeskAssembly.parts.map(part => part.catalogEntry))
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({displayName: 'sample member desk topology test', moduleName: 'ui.integration.sample-console', surfaceForm: 'laptop'}),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ])
    const locator: TopologyLocator = {
      host: '192.0.2.60',
      port: 43172,
      basePath: '/terminal-topology',
      identity: {
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-member-desk-peer',
        displayName: 'Peer',
        instanceMode: 'SLAVE',
        displayRole: 'VICE',
      },
    }
    try {
      await runtime.start()
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator))
      const result = await runtime.dispatchCommand(
        loginSucceededCommand,
        {operatorName: 'A001'},
        {requestId: createRequestId()},
      )
      expect(result.status).toBe('completed')
      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toMatchObject({partKey: 'sample.desk.member-list'})
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toMatchObject({partKey: 'sample.desk.customer-welcome'})
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })

  it('keeps the customer surface on a paired single-screen slave before staff login', async () => {
    const catalog = createUiCatalog(sampleMemberDeskAssembly.parts.map(part => part.catalogEntry))
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({displayName: 'sample member desk slave topology test', moduleName: 'ui.integration.sample-console', surfaceForm: 'laptop'}),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ])
    const locator: TopologyLocator = {
      host: '192.0.2.61',
      port: 43172,
      basePath: '/terminal-topology',
      identity: {
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-member-desk-master',
        displayName: 'Master',
        instanceMode: 'MASTER',
        displayRole: 'CHIEF',
      },
    }
    try {
      await runtime.start()
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator))
      // This fixture represents the persisted single-screen slave boundary;
      // the display-context command path owns validation of these values.
      runtime.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'))
      runtime.getStore().dispatch(setDisplayRoleAction('VICE'))
      const result = await runtime.dispatchCommand(topologyHostEventCommand, {event: 'peer-accepted'}, {requestId: createRequestId()})
      expect(result.status).toBe('completed')
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toBeUndefined()
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })

  it('reconciles the customer surface after a recovered members state transfer', async () => {
    const catalog = createUiCatalog(sampleMemberDeskAssembly.parts.map(part => part.catalogEntry))
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({displayName: 'sample member desk recovered state test', moduleName: 'ui.integration.sample-console', surfaceForm: 'laptop'}),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ])
    const locator: TopologyLocator = {
      host: '192.0.2.62',
      port: 43172,
      basePath: '/terminal-topology',
      identity: {
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-member-desk-recovered-state',
        displayName: 'Master',
        instanceMode: 'MASTER',
        displayRole: 'CHIEF',
      },
    }
    try {
      await runtime.start()
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator))
      runtime.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'))
      runtime.getStore().dispatch(setDisplayRoleAction('VICE'))

      runtime.getStore().dispatch(memberStateActions.setPending({name: 'Alice', phone: '010-0000-0000'}))
      const pendingResult = await runtime.dispatchCommand(
        topologyHostEventCommand,
        {event: 'state-transfer-recovered'},
        {requestId: createRequestId()},
      )
      expect(pendingResult.status).toBe('completed')
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toBeUndefined()

      runtime.getStore().dispatch(memberStateActions.clearPending())
      const clearedResult = await runtime.dispatchCommand(
        topologyHostEventCommand,
        {event: 'state-transfer-recovered'},
        {requestId: createRequestId()},
      )
      expect(clearedResult.status).toBe('completed')
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toBeUndefined()
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })

  it('reads confirm data through the owner selector and renders the two actions', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => ({
          requestId: null,
          commandId: 'command_test' as never,
          status: 'completed' as const,
          actorResults: [],
        })) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
    ))

    expectTextValue(renderer, 'sample.desk.customer-member:name', 'Alice')
    expectTextValue(renderer, 'sample.desk.customer-member:phone', '010-1234-5678')
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:reject'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('renders the single-surface hand-back action only for handheld-confirm', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'handheld-confirm'})),
    ))

    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:reject'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:hand-back'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it.each([
    ['landscape confirm', 'confirm', {width: 960, height: 540}],
    ['portrait handheld-confirm', 'handheld-confirm', {width: 360, height: 720}],
  ] as const)('keeps the customer numeric input actionable in the %s local frame', (_label, mode, frameLayout) => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode})),
    ), frameLayout)

    const ageInput = findTextInput(renderer, 'sample.desk.customer-member:age')
    act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:reject'})).toBeDefined()
    if (mode === 'handheld-confirm') {
      expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:hand-back'})).toBeDefined()
    }
    act(() => { renderer.unmount() })
  })

  it('keeps customer age local, exposes the virtual keyboard, and sends an optional age snapshot', async () => {
    const root = memberRoot({name: 'Alice', phone: '010-1234-5678'})
    const {logger} = createLogger()
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = []
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload})
      return completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(root),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
    ))

    const ageInput = findTextInput(renderer, 'sample.desk.customer-member:age')
    act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})).toBeDefined()
    expect(ageInput.props.maxLength).toBe(3)

    act(() => { ageInput.props.onChangeText('37') })
    expect((root['kernel.feature.sample-member-registry.members'] as {readonly pending: unknown}).pending).toEqual({
      name: 'Alice',
      phone: '010-1234-5678',
    })
    await act(async () => { await press(renderer, 'sample.desk.customer-member:confirm')() })
    expect(dispatched).toContainEqual({name: confirmMemberCommand.commandName, payload: {age: 37}})
    act(() => { renderer.unmount() })
  })

  it('confirms a blank customer age without inventing a value', async () => {
    const {logger} = createLogger()
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = []
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload})
      return completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'handheld-confirm'})),
    ))

    await act(async () => { await press(renderer, 'sample.desk.customer-member:confirm')() })
    expect(dispatched).toContainEqual({name: confirmMemberCommand.commandName, payload: {}})
    act(() => { renderer.unmount() })
  })

  it('keeps the age field and customer decisions in the same input surface', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
    ))
    const ageInput = findTextInput(renderer, 'sample.desk.customer-member:age')
    act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:scroll'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:reject'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('keeps customer decisions available when the frame cannot render a keyboard', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'handheld-confirm'})),
    ), {width: 320, height: 541})
    const ageInput = findTextInput(renderer, 'sample.desk.customer-member:age')
    act(() => { ageInput.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard'})).toHaveLength(0)
    expect(renderer.root.findByProps({testID: 'ui.base.input:unsupported-size'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:reject'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.customer-member:hand-back'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('renders waiting name, phone, and withdraw action from the owner selector', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(WaitingConfirm),
    ))

    expectTextValue(renderer, 'sample.desk.waiting-confirm:member-name', 'Alice')
    expectTextValue(renderer, 'sample.desk.waiting-confirm:member-phone', '010-1234-5678')
    expect(renderer.root.findByProps({testID: 'sample.desk.waiting-confirm:withdraw'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('keeps registry notice decisive with retry and abandon but no dismiss action', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(RegistryNotice, {reasonCode: 'customer-rejected'}),
    ))

    expect(renderer.root.findByProps({testID: 'sample.desk.registry-notice:retry'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.registry-notice:abandon'})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: 'sample.desk.registry-notice:dismiss'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it.each([
    ['error', resultWithActors('error', [actorFailure('SYSTEM')])],
    ['timed-out', resultWithActors('timed-out', [{...actorFailure('SYSTEM'), status: 'timed-out', error: null}])],
    ['partial-failed', resultWithActors('partial-failed', [
      {...actorFailure('SYSTEM'), status: 'completed', error: null},
      actorFailure('SYSTEM'),
    ])],
  ] as const)('observes resolved %s as a system failure without exposing raw error', async (_label, firstResult) => {
    const {logger} = createLogger()
    const commandNames: string[] = []
    const dispatchCommand = (async command => {
      commandNames.push(command.definition.commandName)
      return commandNames.length === 1 ? firstResult : completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
    ))

    const confirm = renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})
    await act(async () => { await (confirm.props.onPress as () => Promise<unknown>)() })
    expect(commandNames).toEqual([
      confirmMemberCommand.commandName,
      deskSystemFailureObservedCommand.commandName,
    ])
    act(() => { renderer.unmount() })
  })

  it('keeps running non-terminal and business failures out of system notice', async () => {
    for (const firstResult of [
      resultWithActors('running', [runningActor()]),
      resultWithActors('error', [actorFailure('BUSINESS')]),
    ]) {
      const {logger} = createLogger()
      const commandNames: string[] = []
      const dispatchCommand = (async command => {
        commandNames.push(command.definition.commandName)
        return firstResult
      }) as RenderProviderProps['dispatchCommand']
      const renderer = mount(createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
      ))

      const confirm = renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})
      await act(async () => { await (confirm.props.onPress as () => Promise<unknown>)() })
      expect(commandNames).toEqual([confirmMemberCommand.commandName])
      act(() => { renderer.unmount() })
    }
  })

  it('renders an allowlisted system operation with fixed copy only', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(DeskSystemNotice, {operation: 'confirm-member'}),
    ))

    expectTextValue(renderer, 'sample.desk.system-notice:message', '操作没有完成，请重试')
    expectTextAbsent(renderer, 'ledger write failed')
    act(() => { renderer.unmount() })
  })

  it('passes the approved member-list row testID into the feature-owned MemberRow', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot(
          {name: 'Pending', phone: '010-0000-0000'},
          [{memberId: 'member-1', name: 'Alice', phone: '010-1234-5678', registeredAt: 1}],
        )),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => ({
          requestId: null,
          commandId: 'command_test' as never,
          status: 'completed' as const,
          actorResults: [],
        })) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(MemberList),
    ))

    expect(renderer.root.findByProps({testID: 'sample.desk.member-list:row'})).toBeDefined()
    expectTextValue(renderer, 'sample.desk.member-list:row:content', 'Alice 010-1234-5678')
    const scrollArea = renderer.root.findByProps({testID: 'sample.desk.member-list:scroll'}) as unknown as TestInstanceQuery
    expect(scrollArea.findAllByProps({testID: 'sample.desk.member-list:row'}).length).toBeGreaterThan(0)
    expect(scrollArea.findAllByProps({testID: 'sample.desk.member-list:add'})).toHaveLength(0)
    expect(scrollArea.findAllByProps({testID: 'sample.desk.member-list:logout'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('keeps member-form actions outside its single scroll ancestor', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: '', phone: ''})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(MemberForm)),
    ))

    const scrollArea = renderer.root.findByProps({testID: 'sample.desk.member-form:scroll'}) as unknown as TestInstanceQuery
    expect(renderer.root.findByProps({testID: 'sample.desk.member-form:title'})).toBeDefined()
    expect(scrollArea.findAllByProps({testID: 'sample.desk.member-form:title'})).toHaveLength(0)
    expect(scrollArea.findByProps({testID: 'sample.desk.member-form:name'})).toBeDefined()
    expect(scrollArea.findByProps({testID: 'sample.desk.member-form:phone'})).toBeDefined()
    expect(scrollArea.findByProps({testID: 'sample.desk.member-form:keyboard-alpha-probe'})).toBeDefined()
    expect(scrollArea.findByProps({testID: 'sample.desk.member-form:keyboard-financial-probe'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.member-form:keyboard-alpha-probe-notice'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'sample.desk.member-form:keyboard-financial-probe-notice'})).toBeDefined()
    expect(scrollArea.findAllByProps({testID: 'sample.desk.member-form:submit'})).toHaveLength(0)
    expect(scrollArea.findAllByProps({testID: 'sample.desk.member-form:cancel'})).toHaveLength(0)
    const actions = renderer.root.findByProps({testID: 'sample.desk.member-form:actions'}) as unknown as TestInstanceQuery
    expect(actions.findByProps({testID: 'sample.desk.member-form:submit'})).toBeDefined()
    expect(actions.findByProps({testID: 'sample.desk.member-form:cancel'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('exercises alpha and financial layouts without adding them to the member payload', async () => {
    const {logger} = createLogger()
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = []
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload})
      return completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: '', phone: ''})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(MemberForm)),
    ))

    const financialInput = findTextInput(renderer, 'sample.desk.member-form:keyboard-financial-probe')
    const phoneInput = findTextInput(renderer, 'sample.desk.member-form:phone')
    act(() => { phoneInput.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined()
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:text-1')() })
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:complete')() })
    act(() => { findTextInput(renderer, 'sample.desk.member-form:keyboard-alpha-probe').props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-a'})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: 'ui.base.input:virtual-keyboard:text--'})).toHaveLength(0)
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:text-a')() })
    act(() => { press(renderer, 'ui.base.input:virtual-keyboard:complete')() })
    act(() => { financialInput.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text--'})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-.'})).toBeDefined()
    expect(financialInput.props.value).toBe('')
    act(() => {
      press(renderer, 'ui.base.input:virtual-keyboard:text-1')()
      press(renderer, 'ui.base.input:virtual-keyboard:text-.')()
      press(renderer, 'ui.base.input:virtual-keyboard:text-2')()
    })
    expect(financialInput.props.value).toBe('1.2')
    act(() => { phoneInput.props.onFocus({nativeEvent: {}}) })
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:text-1'})).toBeDefined()
    await act(async () => { await press(renderer, 'sample.desk.member-form:submit')() })
    expect(dispatched).toContainEqual({
      name: submitMemberCommand.commandName,
      payload: {name: '', phone: '1'},
    })
    act(() => { renderer.unmount() })
  })

  it.each([
    ['landscape PRIMARY', {width: 1280, height: 800}],
    ['portrait PRIMARY', {width: 360, height: 720}],
  ] as const)('covers the member-form numeric, alpha, and financial consumers in the %s frame', (_label, frameLayout) => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: '', phone: ''})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(MemberForm)),
    ), frameLayout)

    const fields = [
      ['sample.desk.member-form:phone', 'ui.base.input:virtual-keyboard:text-1'],
      ['sample.desk.member-form:keyboard-alpha-probe', 'ui.base.input:virtual-keyboard:text-a'],
      ['sample.desk.member-form:keyboard-financial-probe', 'ui.base.input:virtual-keyboard:text-.'],
    ] as const
    for (const [fieldID, keyID] of fields) {
      const field = findTextInput(renderer, fieldID)
      act(() => { field.props.onFocus({nativeEvent: {}}) })
      expect(renderer.root.findByProps({testID: keyID})).toBeDefined()
    }
    act(() => { renderer.unmount() })
  })

  it('submits name and phone from one synchronous input snapshot', async () => {
    const {logger} = createLogger()
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = []
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload})
      return completedResult()
    }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: '', phone: ''})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(MemberForm)),
    ))

    const nameInput = findTextInput(renderer, 'sample.desk.member-form:name')
    const phoneInput = findTextInput(renderer, 'sample.desk.member-form:phone')
    act(() => {
      nameInput.props.onChangeText('Alice')
      phoneInput.props.onChangeText('010-1234-5678')
    })
    await act(async () => { await press(renderer, 'sample.desk.member-form:submit')() })
    expect(dispatched).toContainEqual({
      name: submitMemberCommand.commandName,
      payload: {name: 'Alice', phone: '010-1234-5678'},
    })
    act(() => { renderer.unmount() })
  })

  it('keeps the empty-state action in the fixed action region', () => {
    const {logger} = createLogger()
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: '', phone: ''})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      createElement(MemberList),
    ))

    const scrollArea = renderer.root.findByProps({testID: 'sample.desk.member-list:scroll'}) as unknown as TestInstanceQuery
    const actions = renderer.root.findByProps({testID: 'sample.desk.member-list:actions'}) as unknown as TestInstanceQuery
    expect(scrollArea.findByProps({testID: 'sample.desk.member-list:empty'})).toBeDefined()
    expect(scrollArea.findAllByProps({testID: 'sample.desk.member-list:empty-action'})).toHaveLength(0)
    expect(actions.findByProps({testID: 'sample.desk.member-list:empty-action'})).toBeDefined()
    expect(actions.findByProps({testID: 'sample.desk.member-list:logout'})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('diagnoses infrastructure rejection from a customer decision without treating it as success', async () => {
    const {logger, events} = createLogger()
    const failure = new Error('ledger write failed')
    const dispatchCommand = (async () => { throw failure }) as RenderProviderProps['dispatchCommand']
    const renderer = mount(createElement(
      RenderProvider,
      {
        stateSource: createStateSource(memberRoot({name: 'Pending', phone: '010-0000-0000'})),
        uiCatalog: createUiCatalog([]),
        rendererCatalog: createRendererCatalog([]),
        logger,
        dispatchCommand,
        selectUiVariable: (_root, declaration) => declaration.defaultValue,
      },
      withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
    ))

    const confirm = renderer.root.findByProps({testID: 'sample.desk.customer-member:confirm'})
    await act(async () => {
      await expect((confirm.props.onPress as () => Promise<unknown>)()).rejects.toBe(failure)
    })
    expect(events).toContainEqual(expect.objectContaining({
      category: 'ui.base.render',
      event: 'command-dispatch-rejected',
      data: {failure: 'promise-rejected'},
    }))
    act(() => { renderer.unmount() })
  })

  it('treats a repeated system failure observation as an idempotent existing notice', async () => {
    const catalog = createUiCatalog(sampleMemberDeskAssembly.parts.map(part => part.catalogEntry))
    const loggerEvents: LogEvent[] = []
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({displayName: 'sample member desk test', moduleName: 'ui.integration.sample-console', surfaceForm: 'mobile'}),
      createUiStateModule({catalog, variables: [], surfaceForm: 'mobile'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ], undefined, loggerEvents)
    try {
      await runtime.start()
      const first = await runtime.dispatchCommand(deskSystemFailureObservedCommand, {operation: 'submit-member'}, {requestId: createRequestId()})
      const second = await runtime.dispatchCommand(deskSystemFailureObservedCommand, {operation: 'submit-member'}, {requestId: createRequestId()})
      expect(first.status).toBe('completed')
      expect(second.status).toBe('completed')
      expect(selectLayers(runtime.getState(), 'PRIMARY')).toEqual([
        expect.objectContaining({
          layerId: 'sample.desk.system-notice',
          partKey: 'sample.desk.system-notice',
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
})
