import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {PlatformPortsSection} from '../src/components/sections/PlatformPortsSection'
import {adminTestIds} from '../src/foundations/adminTestIds'
import type {AdminSectionProps} from '../src/types/adminSection'

const context = {
  catalogEntry: {title: '平台端口'},
  runtimeFacts: {
    platformPortCapabilities: [
      {port: 'logger', descriptorStatus: 'complete', capabilities: [{capability: 'info', state: 'real', source: 'adapter'}]},
      {port: 'device', descriptorStatus: 'complete', capabilities: [{capability: 'display', state: 'unavailable', source: 'default'}]},
      {port: 'script', descriptorStatus: 'missing-descriptor', capabilities: []},
    ],
  },
  surface: {surfaceForm: 'laptop'},
} as unknown as AdminSectionProps['context']

const renderSection = (): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(<PlatformPortsSection context={context} />) })
  return renderer!
}

afterEach(() => vi.restoreAllMocks())

describe('PlatformPortsSection high-fidelity summary', () => {
  it('places the status line and ratio bar before the three summary facts', () => {
    const renderer = renderSection()
    const summary = renderer.root.findByProps({testID: 'admin.console.platform-ports:summary-card'})
    const directChildren = (Array.isArray(summary.props.children) ? summary.props.children : [summary.props.children])
      .filter(Boolean)
      .map((child: {props?: {testID?: string}}) => child.props?.testID)

    expect(directChildren).toEqual([
      adminTestIds.ports.overallStatus,
      'admin.console.platform-ports:total',
      adminTestIds.ports.summary.ratioBar,
      'terminal.admin:ports:summary-grid',
    ])
    expect(renderer.root.findByProps({testID: adminTestIds.ports.overallStatus}).type.name).toBe('PrimitiveStatusLine')
    expect(renderer.root.findByProps({testID: adminTestIds.ports.summary.ratioBar})).toBeDefined()
    expect(renderer.root.findByProps({testID: 'terminal.admin:ports:summary-grid'})).toBeDefined()
    act(() => { renderer.unmount() })
  })
})
