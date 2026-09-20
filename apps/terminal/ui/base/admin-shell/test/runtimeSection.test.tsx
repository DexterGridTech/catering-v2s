import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {afterEach, describe, expect, it, vi} from 'vitest'
import type {DisplayFactsReadModel} from '@catering-v2s/kernel-base-display-context'
import * as renderHooks from '@catering-v2s/ui-base-render'
import {RuntimeSection} from '../src/components/sections/RuntimeSection'
import {adminTestIds} from '../src/foundations/adminTestIds'
import type {AdminSectionProps} from '../src/types/adminSection'

const baseFacts = Object.freeze({
  status: 'ready' as const,
  currentSurfaceKey: 'PRIMARY' as const,
  reasonCode: null,
})

const singleFacts = Object.freeze({
  ...baseFacts,
  physicalDisplayCount: 1,
  surfaces: Object.freeze([Object.freeze({
    surfaceKey: 'PRIMARY' as const,
    displayIndex: 0,
    present: true,
    role: 'primary' as const,
    logicalSize: Object.freeze({width: 1280, height: 800}),
    physicalSize: null,
    readiness: 'ready' as const,
  })]),
})

const contextFor = (
  facts: DisplayFactsReadModel,
  surfaceForm: 'laptop' | 'mobile' = 'laptop',
  displayMode: 'PRIMARY' | 'SECONDARY' = 'PRIMARY',
): AdminSectionProps['context'] => ({
  catalogEntry: {title: '运行状态'} as AdminSectionProps['context']['catalogEntry'],
  runtimeFacts: {
    environmentMode: 'TEST',
    debugMode: {enabled: false, source: 'default'},
    deviceIdentity: {available: false, deviceId: null},
    platformPortCapabilities: [],
    displayFacts: facts,
  },
  surface: {
    surfaceForm,
    displayMode,
    hostLogicalSize: {width: 1280, height: 800},
  },
  commandBoundary: {},
} as unknown as AdminSectionProps['context'])

const renderSection = (context: AdminSectionProps['context']): ReactTestRenderer => {
  vi.spyOn(renderHooks, 'useRenderStatus').mockReturnValue('started')
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(<RuntimeSection context={context} />) })
  return renderer!
}

afterEach(() => vi.restoreAllMocks())

describe('RuntimeSection display-facts controls', () => {
  it('renders one current surface with logical, physical and readiness fields', () => {
    const renderer = renderSection(contextFor(singleFacts))
    const surface = renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`})

    expect(renderer.root.findByProps({testID: adminTestIds.runtime.physicalDisplayCount})).toBeDefined()
    expect(surface.props.style).toEqual(expect.objectContaining({aspectRatio: 1.6, minHeight: 176}))
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:0`}).props.children)
      .toBe('已就绪')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:1`}).props.children)
      .toBe('可用状态：正常')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:2`}).props.children)
      .toBe('比例：8:5')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:0`}).props.children)
      .toBe('物理长：未知')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:1`}).props.children)
      .toBe('物理高：未知')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-width`}).props.children)
      .toBe('逻辑长：1280')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-height`}).props.children)
      .toBe('逻辑高：800')
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:status`})).toHaveLength(0)
    renderer.unmount()
  })

  it('keeps the current surface ratio and renders non-current surface as a limited fact card', () => {
    const dualFacts = Object.freeze({
      ...singleFacts,
      physicalDisplayCount: 2,
      surfaces: Object.freeze([
        ...singleFacts.surfaces,
        Object.freeze({
          surfaceKey: 'SECONDARY' as const,
          displayIndex: 1,
          present: true,
          role: 'secondary' as const,
          logicalSize: Object.freeze({width: 1920, height: 1080}),
          physicalSize: Object.freeze({width: 2560, height: 1440}),
          readiness: 'ready' as const,
        }),
      ]),
    })
    const renderer = renderSection(contextFor(dualFacts))

    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`}).props.style)
      .toEqual(expect.objectContaining({aspectRatio: 1.6, minHeight: 176}))
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY`}).props.style).toBeUndefined()
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:card`}).props.style).toBeUndefined()
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:inside:0`}).props.children)
      .toBe('该屏信息未提供')
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:outside:0`})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:logic-width`})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:logic-height`})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:status`})).toHaveLength(0)
    renderer.unmount()
  })

  it('fails closed for mobile multi-surface facts without rendering a second surface', () => {
    const dualFacts = Object.freeze({
      ...singleFacts,
      physicalDisplayCount: 2,
      surfaces: Object.freeze([
        ...singleFacts.surfaces,
        Object.freeze({...singleFacts.surfaces[0]!, surfaceKey: 'SECONDARY' as const, displayIndex: 1, role: 'secondary' as const}),
      ]),
    })
    const renderer = renderSection(contextFor(dualFacts, 'mobile'))

    expect(renderer.root.findByProps({testID: adminTestIds.runtime.displayFactsError})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: adminTestIds.runtime.surfaceMap})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY`})).toHaveLength(0)
    renderer.unmount()
  })
})
