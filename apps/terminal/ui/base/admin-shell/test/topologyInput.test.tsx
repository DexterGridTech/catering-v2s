import {useLayoutEffect} from 'react'
import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {TextInput} from 'react-native'
import * as renderHooks from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame, useInputController} from '@catering-v2s/ui-base-input'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {TopologySection} from '../src/components/sections/TopologySection'
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../src/foundations/adminIdentity'
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
    })

    expect(topologyCapability.pairByHost).toHaveBeenCalledWith({host: '127.0.0.1'})
    act(() => { renderer.unmount() })
  })

  it('renders one page gate and no topology action when the owner denies the page', () => {
    const unavailableContext = {
      ...context,
      topologyCapability: {
        ...topologyCapability,
        getPageAvailability: () => ({available: false as const, reasonCode: 'TOPOLOGY_REQUIRES_SINGLE_SCREEN' as const}),
      },
    } as unknown as AdminSectionProps['context']
    const renderer = mount(undefined, unavailableContext)

    expect(renderer.root.findByProps({testID: 'terminal.admin:topology:page-gate'})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:host'})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:pair'})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: 'terminal.admin:topology:unpair'})).toHaveLength(0)
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
