import {render} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {DisplayFactsReadModel} from '@catering-v2s/kernel-base-display-context';
import * as renderHooks from '@catering-v2s/ui-base-render';
import {RuntimeSectionLaptop} from '../src/components/sections/RuntimeSectionLaptop';
import {RuntimeSectionMobile} from '../src/components/sections/RuntimeSectionMobile';
import {adminTestIds} from '../src/foundations/adminTestIds';
import type {AdminSectionProps} from '../src/types/adminSection';
import {getRenderedNode, queryRenderedTree} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

const baseFacts = Object.freeze({
  status: 'ready' as const,
  currentSurfaceKey: 'PRIMARY' as const,
  reasonCode: null,
});

const singleFacts = Object.freeze({
  ...baseFacts,
  physicalDisplayCount: 1,
  surfaces: Object.freeze([
    Object.freeze({
      surfaceKey: 'PRIMARY' as const,
      displayIndex: 0,
      present: true,
      role: 'primary' as const,
      logicalSize: Object.freeze({width: 1280, height: 720}),
      physicalSize: Object.freeze({width: 1920, height: 1080}),
      readiness: 'ready' as const,
    }),
  ]),
});

const contextFor = (
  facts: DisplayFactsReadModel,
  surfaceForm: 'laptop' | 'mobile' = 'laptop',
  displayMode: 'PRIMARY' | 'SECONDARY' = 'PRIMARY',
): AdminSectionProps['context'] =>
  ({
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
  }) as unknown as AdminSectionProps['context'];

const renderSection = async (context: AdminSectionProps['context'], surfaceForm: 'laptop' | 'mobile' = 'laptop') => {
  vi.spyOn(renderHooks, 'useRenderStatus').mockReturnValue('started');
  return await render(
    surfaceForm === 'laptop' ? <RuntimeSectionLaptop context={context} /> : <RuntimeSectionMobile context={context} />,
  );
};

const node = (renderer: Awaited<ReturnType<typeof render>>, testID: string) =>
  getRenderedNode(renderer, instance => instance.props.testID === testID);

afterEach(() => vi.restoreAllMocks());

describe('RuntimeSection display-facts controls', () => {
  it('renders one current surface with logical, physical and readiness fields', async () => {
    const renderer = await renderSection(contextFor(singleFacts));
    const surface = node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`);

    expect(node(renderer, adminTestIds.runtime.physicalDisplayCount)).toBeDefined();
    expect(surface.props.style).toEqual(
      expect.objectContaining({aspectRatio: 1280 / 720, width: '100%', minWidth: 176, maxWidth: 320, height: 180}),
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:0`).props.children).toBe('已就绪');
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:1`).props.children).toBe(
      '可用状态：正常',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:0`).props.children).toBe(
      '物理长：1920',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:1`).props.children).toBe(
      '物理高：1080',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-width`).props.children).toBe(
      '逻辑分辨率宽：1280',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-height`).props.children).toBe(
      '逻辑分辨率高：800',
    );
    expect(
      queryRenderedTree(
        renderer,
        item => typeof item.props.children === 'string' && (item.props.children as string).includes('设备显示区域：'),
      ),
    ).toHaveLength(0);
    expect(
      queryRenderedTree(
        renderer,
        item => item.props.testID === `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:status`,
      ),
    ).toHaveLength(0);
    await renderer.unmount();
  });

  it('renders independent facts and logical canvas dimensions for both physical screens', async () => {
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
    });
    const renderer = await renderSection(contextFor(dualFacts));

    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`).props.style).toEqual(
      expect.objectContaining({aspectRatio: 1280 / 720, width: '100%', minWidth: 176, maxWidth: 320, height: 180}),
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY`).props.style).toEqual(
      expect.objectContaining({
        aspectRatio: 1024 / 768,
        width: '100%',
        minWidth: 176,
        maxWidth: 320,
        height: expect.any(Number),
      }),
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:card`).props.style).toBeUndefined();
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:inside:0`).props.children).toBe(
      '已就绪',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:inside:1`).props.children).toBe(
      '可用状态：正常',
    );
    expect(
      queryRenderedTree(
        renderer,
        item => typeof item.props.children === 'string' && (item.props.children as string).includes('设备显示区域：'),
      ),
    ).toHaveLength(0);
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:outside:0`).props.children).toBe(
      '物理长：1536',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:outside:1`).props.children).toBe(
      '物理高：1152',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:logic-width`).props.children).toBe(
      '逻辑分辨率宽：960',
    );
    expect(node(renderer, `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:logic-height`).props.children).toBe(
      '逻辑分辨率高：540',
    );
    await renderer.unmount();
  });

  it('fails closed for mobile multi-surface facts without rendering a second surface', async () => {
    const dualFacts = Object.freeze({
      ...singleFacts,
      physicalDisplayCount: 2,
      surfaces: Object.freeze([
        ...singleFacts.surfaces,
        Object.freeze({
          ...singleFacts.surfaces[0]!,
          surfaceKey: 'SECONDARY' as const,
          displayIndex: 1,
          role: 'secondary' as const,
        }),
      ]),
    });
    const renderer = await renderSection(contextFor(dualFacts, 'mobile'), 'mobile');

    expect(node(renderer, adminTestIds.runtime.displayFactsError)).toBeDefined();
    expect(queryRenderedTree(renderer, item => item.props.testID === adminTestIds.runtime.surfaceMap)).toHaveLength(0);
    expect(
      queryRenderedTree(renderer, item => item.props.testID === `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY`),
    ).toHaveLength(0);
    await renderer.unmount();
  });
});
