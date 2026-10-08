import {render} from '@testing-library/react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {deriveTestId} from '@catering-v2s/ui-base-primitives';
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
      automation: {enabled: false, address: '—'},
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
const runtimeFactId = (key: string) => deriveTestId(adminTestIds.node('admin.console.runtime:facts'), 'item', key)!;
const runtimeSurfaceId = (element: string, key: string) => deriveTestId(adminTestIds.runtime.surfaceMap, element, key)!;

afterEach(() => vi.restoreAllMocks());

describe('RuntimeSection display-facts controls', () => {
  it.each(['laptop', 'mobile'] as const)(
    'renders build-time automation facts as text-node values on %s without moving the existing item identity',
    async surfaceForm => {
      const context = contextFor(singleFacts, surfaceForm);
      const enabledContext = {
        ...context,
        runtimeFacts: {
          ...context.runtimeFacts,
          automation: {enabled: true, address: 'ws://127.0.0.1:19090/automation'},
        },
      } as AdminSectionProps['context'];
      const renderer = await renderSection(enabledContext, surfaceForm);

      expect(node(renderer, runtimeFactId('automation-enabled'))).toBeDefined();
      expect(node(renderer, runtimeFactId('automation-address'))).toBeDefined();
      expect(node(renderer, adminTestIds.runtime.automation.enabled).props.children).toBe('已启用');
      expect(node(renderer, adminTestIds.runtime.automation.address).props.children).toBe(
        'ws://127.0.0.1:19090/automation',
      );
      await renderer.unmount();
    },
  );

  it('renders the disabled address as a dash and does not expose connection state', async () => {
    const renderer = await renderSection(contextFor(singleFacts));

    expect(node(renderer, adminTestIds.runtime.automation.enabled).props.children).toBe('未启用');
    expect(node(renderer, adminTestIds.runtime.automation.address).props.children).toBe('—');
    await renderer.unmount();
  });

  it('renders one current surface with logical, physical and readiness fields', async () => {
    const renderer = await renderSection(contextFor(singleFacts));
    const surface = node(renderer, runtimeSurfaceId('surface', 'PRIMARY'));

    expect(node(renderer, adminTestIds.runtime.physicalDisplayCount)).toBeDefined();
    expect(surface.props.style).toEqual(
      expect.objectContaining({aspectRatio: 1280 / 720, width: '100%', minWidth: 176, maxWidth: 320, height: 180}),
    );
    expect(node(renderer, runtimeSurfaceId('surface-inside', 'PRIMARY:0')).props.children).toBe('已就绪');
    expect(node(renderer, runtimeSurfaceId('surface-inside', 'PRIMARY:1')).props.children).toBe('可用状态：正常');
    expect(node(renderer, runtimeSurfaceId('surface-outside', 'PRIMARY:0')).props.children).toBe('物理长：1920');
    expect(node(renderer, runtimeSurfaceId('surface-outside', 'PRIMARY:1')).props.children).toBe('物理高：1080');
    expect(node(renderer, runtimeSurfaceId('surface-logic-width', 'PRIMARY')).props.children).toBe(
      '逻辑分辨率宽：1280',
    );
    expect(node(renderer, runtimeSurfaceId('surface-logic-height', 'PRIMARY')).props.children).toBe(
      '逻辑分辨率高：800',
    );
    expect(
      queryRenderedTree(
        renderer,
        item => typeof item.props.children === 'string' && (item.props.children as string).includes('设备显示区域：'),
      ),
    ).toHaveLength(0);
    expect(
      queryRenderedTree(renderer, item => item.props.testID === runtimeSurfaceId('surface-status', 'PRIMARY')),
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

    expect(node(renderer, runtimeSurfaceId('surface', 'PRIMARY')).props.style).toEqual(
      expect.objectContaining({aspectRatio: 1280 / 720, width: '100%', minWidth: 176, maxWidth: 320, height: 180}),
    );
    expect(node(renderer, runtimeSurfaceId('surface', 'SECONDARY')).props.style).toEqual(
      expect.objectContaining({
        aspectRatio: 1024 / 768,
        width: '100%',
        minWidth: 176,
        maxWidth: 320,
        height: expect.any(Number),
      }),
    );
    expect(node(renderer, runtimeSurfaceId('surface-card', 'PRIMARY')).props.style).toBeUndefined();
    expect(node(renderer, runtimeSurfaceId('surface-inside', 'SECONDARY:0')).props.children).toBe('已就绪');
    expect(node(renderer, runtimeSurfaceId('surface-inside', 'SECONDARY:1')).props.children).toBe('可用状态：正常');
    expect(
      queryRenderedTree(
        renderer,
        item => typeof item.props.children === 'string' && (item.props.children as string).includes('设备显示区域：'),
      ),
    ).toHaveLength(0);
    expect(node(renderer, runtimeSurfaceId('surface-outside', 'SECONDARY:0')).props.children).toBe('物理长：1536');
    expect(node(renderer, runtimeSurfaceId('surface-outside', 'SECONDARY:1')).props.children).toBe('物理高：1152');
    expect(node(renderer, runtimeSurfaceId('surface-logic-width', 'SECONDARY')).props.children).toBe(
      '逻辑分辨率宽：960',
    );
    expect(node(renderer, runtimeSurfaceId('surface-logic-height', 'SECONDARY')).props.children).toBe(
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
      queryRenderedTree(renderer, item => item.props.testID === runtimeSurfaceId('surface', 'SECONDARY')),
    ).toHaveLength(0);
    await renderer.unmount();
  });
});
