import {describe, expect, it} from 'vitest'
import {projectRuntimeDisplay} from '../src/foundations/runtimeDisplay'

const singleFacts = Object.freeze({
  status: 'ready' as const,
  physicalDisplayCount: 1,
  currentSurfaceKey: null,
  surfaces: Object.freeze([{
    surfaceKey: 'PRIMARY' as const,
    displayIndex: 0,
    present: true,
    role: 'primary' as const,
    logicalSize: {width: 1280, height: 800},
    physicalSize: null,
    readiness: 'ready' as const,
  }]),
  reasonCode: null,
})

describe('runtime display projection', () => {
  it('keeps current physical unknown explicit and does not create forbidden non-current fields', () => {
    const projection = projectRuntimeDisplay({
      facts: singleFacts,
      surfaceForm: 'laptop',
      renderDisplayMode: 'PRIMARY',
      currentLogicalSize: null,
    })
    expect(projection.status).toBe('ready')
    expect(projection.surfaces[0]).toMatchObject({
      current: true,
      insideLabels: ['已就绪', '可用状态：正常', '比例：8:5'],
      outsideLabels: [],
      logicWidthLabel: '逻辑长：1280',
      logicHeightLabel: '逻辑高：800',
      physicalWidthLabel: '物理长：未知',
      physicalHeightLabel: '物理高：未知',
    })
    expect(projection.surfaces[0]).not.toHaveProperty('statusLabel')

    const dual = projectRuntimeDisplay({
      facts: {...singleFacts, physicalDisplayCount: 2, surfaces: Object.freeze([
        ...singleFacts.surfaces,
        {
          surfaceKey: 'SECONDARY' as const,
          displayIndex: 1,
          present: true,
          role: 'secondary' as const,
          logicalSize: {width: 1920, height: 1080},
          physicalSize: {width: 2560, height: 1440},
          readiness: 'ready' as const,
        },
      ])},
      surfaceForm: 'laptop',
      renderDisplayMode: 'PRIMARY',
      currentLogicalSize: null,
    })
    expect(dual.surfaces[1]).toMatchObject({
      current: false,
      insideLabels: ['该屏信息未提供', '仅保留存在性与角色'],
      outsideLabels: [],
    })
    expect(dual.surfaces[1]).not.toHaveProperty('statusLabel')
    expect(dual.surfaces[1]).not.toHaveProperty('logicWidthLabel')
    expect(dual.surfaces[1]).not.toHaveProperty('physicalWidthLabel')
  })

  it('fails closed for mobile multi-surface input and malformed facts', () => {
    const dualFacts = {...singleFacts, physicalDisplayCount: 2, surfaces: Object.freeze([
      ...singleFacts.surfaces,
      {...singleFacts.surfaces[0]!, surfaceKey: 'SECONDARY' as const, displayIndex: 1, role: 'secondary' as const},
    ])}
    expect(projectRuntimeDisplay({
      facts: dualFacts,
      surfaceForm: 'mobile',
      renderDisplayMode: 'PRIMARY',
      currentLogicalSize: null,
    })).toMatchObject({status: 'error', reason: 'mobile 形态不支持多屏显示事实', surfaces: []})
    expect(projectRuntimeDisplay({
      facts: undefined,
      surfaceForm: 'laptop',
      renderDisplayMode: 'PRIMARY',
      currentLogicalSize: null,
    })).toMatchObject({status: 'error', reason: '显示事实未提供', surfaces: []})
  })
})
