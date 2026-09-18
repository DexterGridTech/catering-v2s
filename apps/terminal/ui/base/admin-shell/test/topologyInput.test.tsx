import {useLayoutEffect} from 'react'
import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {TextInput} from 'react-native'
import * as renderHooks from '@catering-v2s/ui-base-render'
import {InputSurfaceFrame, useInputController} from '@catering-v2s/ui-base-input'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {TopologySection} from '../src/components/sections/TopologySection'
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../src/foundations/adminIdentity'
import type {AdminSectionProps} from '../src/types/adminSection'

const context = {
  catalogEntry: {title: '拓扑'},
  topologyCapability: {
    getSnapshot: () => undefined,
    getOperationEligibility: (operation: string) => ({operation, allowed: true}),
  },
} as unknown as AdminSectionProps['context']

const ActivateAdminFocusScope = () => {
  const controller = useInputController()
  useLayoutEffect(() => {
    controller.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID)
  }, [controller])
  return null
}

const mount = (): ReactTestRenderer => {
  vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(undefined)
  vi.spyOn(renderHooks, 'useRenderContext').mockReturnValue({
    logger: {info: vi.fn(), error: vi.fn()},
  } as unknown as ReturnType<typeof renderHooks.useRenderContext>)
  let renderer: ReactTestRenderer | undefined
  act(() => {
    renderer = create(
      <InputSurfaceFrame>
        <ActivateAdminFocusScope />
        <TopologySection context={context} />
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
})
