import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {afterEach, describe, expect, it, vi} from 'vitest'
import type {DisplayFactsReadModel} from '@catering-v2s/kernel-base-display-context'
import * as renderHooks from '@catering-v2s/ui-base-render'
import {RuntimeSectionLaptop} from '../src/components/sections/RuntimeSectionLaptop'
import {RuntimeSectionMobile} from '../src/components/sections/RuntimeSectionMobile'
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
    logicalSize: Object.freeze({width: 1280, height: 720}),
    physicalSize: Object.freeze({width: 1920, height: 1080}),
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
    surfaceCanvasSizes: {
      PRIMARY: {width: 1280, height: 800},
      ...(facts.physicalDisplayCount === 2 ? {SECONDARY: {width: 960, height: 540}} : {}),
    },
  },
  surface: {
    surfaceForm,
    displayMode,
    hostLogicalSize: {width: 1280, height: 800},
  },
  commandBoundary: {},
} as unknown as AdminSectionProps['context'])

const renderSection = (context: AdminSectionProps['context'], surfaceForm: 'laptop' | 'mobile' = 'laptop'): ReactTestRenderer => {
  vi.spyOn(renderHooks, 'useRenderStatus').mockReturnValue('started')
  let renderer: ReactTestRenderer | undefined
  act(() => { renderer = create(surfaceForm === 'laptop' ? <RuntimeSectionLaptop context={context} /> : <RuntimeSectionMobile context={context} />) })
  return renderer!
}

afterEach(() => vi.restoreAllMocks())

describe('RuntimeSection display-facts controls', () => {
  it('renders one current surface with logical, physical and readiness fields', () => {
    const renderer = renderSection(contextFor(singleFacts))
    const surface = renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`})

    expect(renderer.root.findByProps({testID: adminTestIds.runtime.physicalDisplayCount})).toBeDefined()
    expect(surface.props.style).toEqual(expect.objectContaining({aspectRatio: 1280 / 720, width: '100%', minWidth: 176, maxWidth: 320, height: 180}))
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:0`}).props.children)
      .toBe('已就绪')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:1`}).props.children)
      .toBe('可用状态：正常')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:0`}).props.children)
      .toBe('物理长：1920')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:1`}).props.children)
      .toBe('物理高：1080')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-width`}).props.children)
      .toBe('逻辑分辨率宽：1280')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-height`}).props.children)
      .toBe('逻辑分辨率高：800')
    expect(renderer.root.findAll(node => typeof node.props.children === 'string' && node.props.children.includes('设备显示区域：')))
      .toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:status`})).toHaveLength(0)
    renderer.unmount()
  })

  it('renders independent facts and logical canvas dimensions for both physical screens', () => {
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
          logicalSize: Object.freeze({width: 1024, height: 768}),
          physicalSize: Object.freeze({width: 1536, height: 1152}),
          readiness: 'ready' as const,
        }),
      ]),
    })
    const renderer = renderSection(contextFor(dualFacts))

    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`}).props.style)
      .toEqual(expect.objectContaining({aspectRatio: 1280 / 720, width: '100%', minWidth: 176, maxWidth: 320, height: 180}))
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY`}).props.style)
      .toEqual(expect.objectContaining({aspectRatio: 1024 / 768, width: '100%', minWidth: 176, maxWidth: 320, height: expect.any(Number)}))
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:card`}).props.style).toBeUndefined()
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:inside:0`}).props.children)
      .toBe('已就绪')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:inside:1`}).props.children)
      .toBe('可用状态：正常')
    expect(renderer.root.findAll(node => typeof node.props.children === 'string' && node.props.children.includes('设备显示区域：')))
      .toHaveLength(0)
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:outside:0`}).props.children)
      .toBe('物理长：1536')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:outside:1`}).props.children)
      .toBe('物理高：1152')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:logic-width`}).props.children)
      .toBe('逻辑分辨率宽：960')
    expect(renderer.root.findByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:logic-height`}).props.children)
      .toBe('逻辑分辨率高：540')
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
    const renderer = renderSection(contextFor(dualFacts, 'mobile'), 'mobile')

    expect(renderer.root.findByProps({testID: adminTestIds.runtime.displayFactsError})).toBeDefined()
    expect(renderer.root.findAllByProps({testID: adminTestIds.runtime.surfaceMap})).toHaveLength(0)
    expect(renderer.root.findAllByProps({testID: `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY`})).toHaveLength(0)
    renderer.unmount()
  })
})
