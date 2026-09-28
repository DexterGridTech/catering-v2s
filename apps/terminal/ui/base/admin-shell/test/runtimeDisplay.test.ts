import {describe, expect, it} from 'vitest';
import {projectRuntimeDisplay} from '../src/foundations/runtimeDisplay';

const singleFacts = Object.freeze({
  status: 'ready' as const,
  physicalDisplayCount: 1,
  currentSurfaceKey: null,
  surfaces: Object.freeze([
    {
      surfaceKey: 'PRIMARY' as const,
      displayIndex: 0,
      present: true,
      role: 'primary' as const,
      logicalSize: {width: 1280, height: 720},
      physicalSize: {width: 1920, height: 1080},
      readiness: 'ready' as const,
    },
  ]),
  reasonCode: null,
});

describe('runtime display projection', () => {
  it('shows canvas, physical dimensions and readiness while keeping device logical size only for geometry', () => {
    const projection = projectRuntimeDisplay({
      facts: singleFacts,
      surfaceCanvasSizes: {PRIMARY: {width: 1280, height: 800}},
      surfaceForm: 'laptop',
      renderDisplayMode: 'PRIMARY',
      currentLogicalSize: null,
    });
    expect(projection.status).toBe('ready');
    expect(projection.surfaces[0]).toMatchObject({
      current: true,
      insideLabels: ['已就绪', '可用状态：正常'],
      outsideLabels: [],
      logicWidthLabel: '逻辑分辨率宽：1280',
      logicHeightLabel: '逻辑分辨率高：800',
      physicalWidthLabel: '物理长：1920',
      physicalHeightLabel: '物理高：1080',
    });
    expect(projection.surfaces[0]?.aspectRatio).toBe(1280 / 720);
    expect(projection.surfaces[0]?.insideLabels.join(' ')).not.toContain('设备显示区域');
    expect(projection.surfaces[0]).not.toHaveProperty('statusLabel');

    const dual = projectRuntimeDisplay({
      facts: {
        ...singleFacts,
        physicalDisplayCount: 2,
        surfaces: Object.freeze([
          ...singleFacts.surfaces,
          {
            surfaceKey: 'SECONDARY' as const,
            displayIndex: 1,
            present: true,
            role: 'secondary' as const,
            logicalSize: {width: 1024, height: 768},
            physicalSize: {width: 1536, height: 1152},
            readiness: 'ready' as const,
          },
        ]),
      },
      surfaceCanvasSizes: {
        PRIMARY: {width: 1280, height: 800},
        SECONDARY: {width: 960, height: 540},
      },
      surfaceForm: 'laptop',
      renderDisplayMode: 'PRIMARY',
      currentLogicalSize: null,
    });
    expect(dual.surfaces[1]).toMatchObject({
      current: false,
      aspectRatio: 1024 / 768,
      insideLabels: ['已就绪', '可用状态：正常'],
      outsideLabels: [],
      logicWidthLabel: '逻辑分辨率宽：960',
      logicHeightLabel: '逻辑分辨率高：540',
      physicalWidthLabel: '物理长：1536',
      physicalHeightLabel: '物理高：1152',
    });
    expect(dual.surfaces[1]?.insideLabels.join(' ')).not.toContain('设备显示区域');
  });

  it('fails closed for mobile multi-surface input and malformed facts', () => {
    const dualFacts = {
      ...singleFacts,
      physicalDisplayCount: 2,
      surfaces: Object.freeze([
        ...singleFacts.surfaces,
        {...singleFacts.surfaces[0]!, surfaceKey: 'SECONDARY' as const, displayIndex: 1, role: 'secondary' as const},
      ]),
    };
    expect(
      projectRuntimeDisplay({
        facts: dualFacts,
        surfaceCanvasSizes: {PRIMARY: {width: 1280, height: 800}},
        surfaceForm: 'mobile',
        renderDisplayMode: 'PRIMARY',
        currentLogicalSize: null,
      }),
    ).toMatchObject({status: 'error', reason: 'mobile 形态不支持多屏显示事实', surfaces: []});
    expect(
      projectRuntimeDisplay({
        facts: undefined,
        surfaceCanvasSizes: {PRIMARY: {width: 1280, height: 800}},
        surfaceForm: 'laptop',
        renderDisplayMode: 'PRIMARY',
        currentLogicalSize: null,
      }),
    ).toMatchObject({status: 'error', reason: '显示事实未提供', surfaces: []});
  });
});
