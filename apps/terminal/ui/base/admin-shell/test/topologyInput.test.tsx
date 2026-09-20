import {useLayoutEffect} from 'react'
import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {TextInput} from 'react-native'
import * as renderHooks from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame, useInputController} from '@catering-v2s/ui-base-input'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {TopologySection} from '../src/components/sections/TopologySection'
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../src/foundations/adminIdentity'
import {adminTestIds} from '../src/foundations/adminTestIds'
import type {AdminSectionProps} from '../src/types/adminSection'

const topologyFacts = Object.freeze({
  surfaceForm: 'laptop' as const,
  displayCount: 1,
  instanceMode: 'MASTER' as const,
  displayRole: 'CHIEF' as const,
  paired: false,
  peerReachable: false,
  hasTopologySecondarySurface: false,
  masterLocator: null,
  peerIdentity: null,
  hostAddress: null,
  hostDesired: false,
  hostActual: 'stopped' as const,
  hostErrorCode: null,
  payloadFailure: null,
})

const topologyCapability = {
  getSnapshot: () => topologyFacts,
  getPageAvailability: () => ({available: true as const, reasonCode: 'allowed' as const}),
  getOperationEligibility: (operation: string) => ({operation, allowed: true, reasonCode: 'allowed' as const}),
  pairByHost: vi.fn(async () => ({status: 'completed' as const})),
  unpair: vi.fn(async () => ({status: 'completed' as const})),
  setHostEnabled: vi.fn(async () => ({status: 'completed' as const})),
}

const context = {
  catalogEntry: {title: '拓扑'},
  topologyCapability,
} as unknown as AdminSectionProps['context']

const ActivateAdminFocusScope = () => {
  const controller = useInputController()
  useLayoutEffect(() => {
    controller.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID)
  }, [controller])
  return null
}

const mount = (
  selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(topologyFacts),
  sectionContext = context,
): ReactTestRenderer => {
  vi.spyOn(renderHooks, 'useRenderContext').mockReturnValue({
    logger: {info: vi.fn(), error: vi.fn()},
  } as unknown as ReturnType<typeof renderHooks.useRenderContext>)
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(
      <InputSurfaceFrame>
        <ActivateAdminFocusScope />
        <TopologySection context={sectionContext} />
      </InputSurfaceFrame>,
    )
  })
  act(() => {
    renderer!.root.findByProps({testID: 'ui.base.input:surface-frame'}).props.onLayout({
      nativeEvent: {layout: {width: 960, height: 540}},
    })
  })
  return renderer!
}

afterEach(() => vi.restoreAllMocks())

describe('TopologySection host input', () => {
  it('routes host address through the shared financial virtual keyboard', () => {
    const renderer = mount()
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'terminal.admin:topology:host')
    expect(input).toBeDefined()

    act(() => {
      input!.props.onPressIn({stopPropagation: () => undefined})
      input!.props.onFocus({nativeEvent: {}})
    })

    for (const character of '127.0.0.1') {
      act(() => {
        renderer.root.findByProps({testID: `ui.base.input:virtual-keyboard:text-${character}`}).props.onPress()
      })
    }

    expect(renderer.root.findByType(TextInput).props.value).toBe('127.0.0.1')
    expect(renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard'})).toBeDefined()
    act(() => {
      renderer.root.findByProps({testID: 'ui.base.input:virtual-keyboard:complete'}).props.onPress()
    })
    act(() => { renderer.unmount() })
  })

  it('renders the two goal cards without exposing an identity-query action', () => {
    const renderer = mount()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.goalChoice})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.goalHost})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.goalSlave})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.pairResult}).type.name).toBe('PrimitiveStatusLine')
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.operationFeedback})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:identity-query'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('renders host-ready address facts and removes direct pairing input', () => {
    const readyFacts = {
      ...topologyFacts,
      hostDesired: true,
      hostActual: 'running' as const,
      hostAddress: {host: '192.0.2.10', port: 43172, basePath: '/terminal-topology'},
    }
    const readyContext = {
      ...context,
      topologyCapability: {...topologyCapability, getSnapshot: () => readyFacts},
    } as unknown as AdminSectionProps['context']
    const renderer = mount(vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(readyFacts), readyContext)
    expect(renderer.root.findByProps({testID: adminTestIds.topology.hostService})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.hostServiceState})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.hostIp})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.goalChoice})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.pair})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('renders typed host failure with a retry action', () => {
    const failedFacts = {
      ...topologyFacts,
      hostDesired: true,
      hostActual: 'error' as const,
      hostErrorCode: 'TOPOLOGY_HOST_PORT_OCCUPIED',
    }
    const failedContext = {
      ...context,
      topologyCapability: {...topologyCapability, getSnapshot: () => failedFacts},
    } as unknown as AdminSectionProps['context']
    const renderer = mount(vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(failedFacts), failedContext)
    expect(renderer.root.findByProps({testID: adminTestIds.topology.failureReason})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.retry})).toBeDefined()
    act(() => { renderer.unmount() })
  })

  it('keeps paired reconnecting semantics and exposes unpair for both roles', () => {
    const pairedFacts = {
      ...topologyFacts,
      instanceMode: 'SLAVE' as const,
      displayRole: 'VICE' as const,
      paired: true,
      peerReachable: false,
      peerIdentity: {
        protocolVersion: 1 as const,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-master',
        displayName: '主机',
        instanceMode: 'MASTER' as const,
        displayRole: 'CHIEF' as const,
      },
    }
    const pairedContext = {
      ...context,
      topologyCapability: {...topologyCapability, getSnapshot: () => pairedFacts},
    } as unknown as AdminSectionProps['context']
    const renderer = mount(vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(pairedFacts), pairedContext)
    expect(renderer.root.findByProps({testID: adminTestIds.topology.pairing})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.reachability})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.counterparty})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.pairState})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.topology.unpair})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.goalChoice})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.host})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })

  it('keeps the pairing result bound to owner facts after a successful unpair', async () => {
    const pairedFacts = {
      ...topologyFacts,
      paired: true,
      peerReachable: true,
      peerIdentity: {
        protocolVersion: 1 as const,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-slave',
        displayName: '副机',
        instanceMode: 'SLAVE' as const,
        displayRole: 'VICE' as const,
      },
    }
    const unpairedFacts = {...topologyFacts}
    let currentFacts = pairedFacts
    const unpair = vi.fn(async () => {
      currentFacts = unpairedFacts
      return {status: 'completed' as const}
    })
    const pairedContext = {
      ...context,
      topologyCapability: {
        ...topologyCapability,
        getSnapshot: () => currentFacts,
        unpair,
      },
    } as unknown as AdminSectionProps['context']
    const selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockImplementation(() => currentFacts)
    const renderer = mount(selectorSpy, pairedContext)

    await act(async () => {
      renderer.root.findByProps({testID: adminTestIds.topology.unpair}).props.onPress()
      await new Promise(resolve => setTimeout(resolve, 1_900))
    })

    expect(renderer.root.findByProps({testID: adminTestIds.topology.pairResult}).props.children).toContain('尚未配对')
    expect(renderer.root.findByProps({testID: adminTestIds.topology.operationFeedback}).props.children).toBe('解绑提交完成，等待状态同步')
    act(() => { renderer.unmount() })
  })

  it('subscribes to owner topology facts instead of reading a private state selector', () => {
    const selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(topologyFacts)
    const renderer = mount(selectorSpy)
    expect(selectorSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Function))
    act(() => { renderer.unmount() })
  })

  it('submits the entered host directly through the owner capability', async () => {
    const renderer = mount()
    const input = renderer.root.findAllByType(TextInput).find(node => node.props.testID === 'terminal.admin:topology:host')
    expect(input).toBeDefined()

    act(() => {
      input!.props.onPressIn({stopPropagation: () => undefined})
      input!.props.onFocus({nativeEvent: {}})
    })
    for (const character of '127.0.0.1') {
      act(() => {
        renderer.root.findByProps({testID: `ui.base.input:virtual-keyboard:text-${character}`}).props.onPress()
      })
    }
    await act(async () => {
      renderer.root.findByProps({testID: 'terminal.admin:topology:pair'}).props.onPress()
      await new Promise(resolve => setTimeout(resolve, 850))
    })

    expect(topologyCapability.pairByHost).toHaveBeenCalledWith({host: '127.0.0.1'})
    act(() => { renderer.unmount() })
  })

  it('renders one page gate and no topology action when the owner denies the page', () => {
    const getOperationEligibility = vi.fn((operation: string) => ({operation, allowed: true, reasonCode: 'allowed' as const}))
    const unavailableContext = {
      ...context,
      topologyCapability: {
        ...topologyCapability,
        getOperationEligibility,
        getPageAvailability: () => ({available: false as const, reasonCode: 'TOPOLOGY_REQUIRES_SINGLE_SCREEN' as const}),
      },
    } as unknown as AdminSectionProps['context']
    const renderer = mount(undefined, unavailableContext)

    expect(renderer.root.findByProps({testID: 'terminal.admin:topology:page-gate'})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:host'})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:pair'})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:unpair'})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.hostService})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.pairing})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.counterparty})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: adminTestIds.topology.displayCount})).toHaveLength(0)
    expect(getOperationEligibility).not.toHaveBeenCalled()
    act(() => { renderer.unmount() })
  })

  it('hides target selection and host action after the owner reports a paired slave', () => {
    const pairedSlaveFacts = {...topologyFacts, instanceMode: 'SLAVE' as const, displayRole: 'VICE' as const, paired: true, peerReachable: true}
    const pairedSlaveContext = {
      ...context,
      topologyCapability: {
        ...topologyCapability,
        getSnapshot: () => pairedSlaveFacts,
      },
    } as unknown as AdminSectionProps['context']
    const selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(pairedSlaveFacts)
    const renderer = mount(selectorSpy, pairedSlaveContext)

    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:host'})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:pair'})).toHaveLength(0)
    expect(renderer.root.findByProps({testID: 'terminal.admin:topology:unpair'})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:enable'})).toHaveLength(0)
    act(() => { renderer.unmount() })
  })
})
