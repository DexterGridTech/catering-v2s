import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {afterEach, describe, expect, it, vi} from 'vitest'
import * as renderHooks from '@catering-v2s/ui-base-render'
import {DisplayContextSection} from '../src/components/sections/DisplayContextSection'
import type {AdminSectionProps} from '../src/types/adminSection'
import {adminTestIds} from '../src/foundations/adminTestIds'

const context = {
  catalogEntry: {title: '运行状态'},
  runtimeFacts: {
    environmentMode: 'development',
    debugMode: {enabled: false, source: 'default'},
    deviceIdentity: {available: false, deviceId: null},
    platformPortCapabilities: [],
  },
  surface: {surfaceForm: 'laptop', displayMode: 'PRIMARY', hostLogicalSize: null},
  commandBoundary: {},
} as unknown as AdminSectionProps['context']

const findText = (renderer: ReactTestRenderer, text: string) => renderer.root.findAll(node => node.type === 'Text' && node.props.children === text)

const renderSection = (status: 'created' | 'started') => {
  vi.spyOn(renderHooks, 'useRenderStatus').mockReturnValue(status)
  vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(undefined)
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(<DisplayContextSection context={context} />) })
  return renderer!
}

afterEach(() => vi.restoreAllMocks())

describe('DisplayContextSection lifecycle boundary', () => {
  it('uses runtime status for lifecycle unavailability', () => {
    const renderer = renderSection('created')

    expect(renderer.root.findByProps({testID: adminTestIds.runtime.overallStatus})).toBeDefined()
    expect(renderer.root.findByProps({testID: adminTestIds.runtime.displayFactsError})).toBeDefined()
    renderer.unmount()
  })

  it('keeps missing display data distinct from runtime unavailability after start', () => {
    const renderer = renderSection('started')

    expect(renderer.root.findByProps({testID: adminTestIds.runtime.overallStatus})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: adminTestIds.runtime.displayFactsError}).length).toBeGreaterThan(0)
    renderer.unmount()
  })
})
