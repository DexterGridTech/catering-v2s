import {useLayoutEffect} from 'react';
import {act, render, type RenderResult} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import * as renderHooks from '@catering-v2s/ui-base-render';
import {InputSurfaceFrame, useInputController} from '@catering-v2s/ui-base-input';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {TopologySectionLaptop} from '../src/components/sections/TopologySectionLaptop';
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../src/foundations/adminIdentity';
import {adminTestIds} from '../src/foundations/adminTestIds';
import type {AdminSectionProps} from '../src/types/adminSection';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  type NativeTestHostProps,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {
  getRenderedByProps,
  getRenderedDescendantByProps,
  queryRenderedByProps,
  queryRenderedByType,
  type RenderedTestInstance,
} from '../../../../../../tools/terminal-shared/rntl-rendered-tree';

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const [{withNativeTestHosts}, reactRuntime] = await Promise.all([
    import('../../../../../../tools/terminal-shared/rntl-native-test-host'),
    import('react'),
  ]);
  return withNativeTestHosts(actual, reactRuntime);
});

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
  hostAddress: null,
  hostDesired: false,
  hostActual: 'stopped' as const,
  hostErrorCode: null,
  payloadFailure: null,
});

const topologyCapability = {
  getSnapshot: () => topologyFacts,
  getPageAvailability: () => ({available: true as const, reasonCode: 'allowed' as const}),
  getOperationEligibility: (operation: string) => ({operation, allowed: true, reasonCode: 'allowed' as const}),
  pairByHost: vi.fn(async () => ({status: 'completed' as const})),
  unpair: vi.fn(async () => ({status: 'completed' as const})),
  setHostEnabled: vi.fn(async () => ({status: 'completed' as const})),
};

const context = {
  catalogEntry: {title: '拓扑'},
  topologyCapability,
} as unknown as AdminSectionProps['context'];

type TestRenderer = RenderResult;
type TestNode = Omit<RenderedTestInstance, 'props'> & Readonly<{readonly props: Record<string, any>}>;
const getNode = (renderer: TestRenderer, testID: string): TestNode =>
  getRenderedByProps(renderer, {testID}) as TestNode;
const queryNodes = (renderer: TestRenderer, testID: string): TestNode[] =>
  queryRenderedByProps(renderer, {testID}) as TestNode[];
const queryNodesByType = (renderer: TestRenderer, type: string): TestNode[] =>
  queryRenderedByType(renderer, type) as TestNode[];

const ActivateAdminFocusScope = () => {
  const controller = useInputController();
  useLayoutEffect(() => {
    controller.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID);
  }, [controller]);
  return null;
};

const mount = async (
  selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(topologyFacts),
  sectionContext = context,
): Promise<TestRenderer> => {
  vi.spyOn(renderHooks, 'useRenderContext').mockReturnValue({
    logger: {info: vi.fn(), error: vi.fn()},
  } as unknown as ReturnType<typeof renderHooks.useRenderContext>);
  const surfaceRoot = {};
  const scrollContent = {};
  setNativeTestRefFactory((hostName: string, props: NativeTestHostProps) => {
    const testID = props.testID;
    if (hostName === 'View' && testID === 'ui.base.input:surface-frame') return surfaceRoot;
    if (hostName === 'ScrollView' && testID === 'terminal.admin:topology:scroll') {
      return {
        measureLayout: (
          relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          expect(relativeTo).toBe(surfaceRoot);
          callback(0, 0, 960, 540);
        },
        getInnerViewRef: () => scrollContent,
        scrollTo: () => undefined,
      };
    }
    if (testID === 'terminal.admin:topology:host') {
      return {
        measureLayout: (
          relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          expect(relativeTo).toBe(scrollContent);
          callback(0, 500, 300, 40);
        },
        focus: () => undefined,
        blur: () => undefined,
      };
    }
    return {};
  });
  const renderer = await render(
    <InputSurfaceFrame>
      <ActivateAdminFocusScope />
      <TopologySectionLaptop context={sectionContext} />
    </InputSurfaceFrame>,
  );
  await act(async () => {
    getNode(renderer, 'ui.base.input:surface-frame').props.onLayout({nativeEvent: {layout: {width: 960, height: 540}}});
    const scrollView = getNode(renderer, 'terminal.admin:topology:scroll');
    scrollView.props.onLayout({nativeEvent: {layout: {x: 0, y: 0, width: 960, height: 540}}});
    scrollView.props.onContentSizeChange(960, 900);
    scrollView.props.onScroll({nativeEvent: {contentOffset: {y: 0}}});
  });
  return renderer;
};

const measureKeyboardLayers = async (renderer: TestRenderer): Promise<void> => {
  const measurementLayers = queryNodes(renderer, 'ui.base.input:keyboard-layer-position:measure');
  for (const layer of measurementLayers) {
    const backdrop = getRenderedDescendantByProps(layer, {testID: 'ui.base.input:virtual-keyboard:backdrop'});
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{
      readonly width: number;
      readonly height: number;
    }>;
    await act(async () => {
      layer.props.onLayout({nativeEvent: {layout}});
    });
  }
};

const finishKeyboardPresentation = async (renderer: TestRenderer): Promise<void> => {
  setAnimatedTimingAutoFinishForTests(true);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (queryNodes(renderer, 'ui.base.input:keyboard-layer-position:measure').length === 0) break;
    await measureKeyboardLayers(renderer);
    await act(async () => {
      advanceAnimatedTimingsForTests(1);
    });
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  resetNativeTestRefFactory();
});

describe('TopologySection host input', () => {
  it('routes host address through the shared financial virtual keyboard', async () => {
    const renderer = await mount();
    const input = queryNodesByType(renderer, 'TextInput').find(
      node => node.props.testID === 'terminal.admin:topology:host',
    );
    expect(input).toBeDefined();

    await act(() => {
      input!.props.onPressIn({stopPropagation: () => undefined});
      input!.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);

    for (const character of '127.0.0.1') {
      await act(() => {
        getNode(renderer, `ui.base.input:virtual-keyboard:text-${character}`).props.onPress();
      });
    }

    expect(queryNodesByType(renderer, 'TextInput')[0].props.value).toBe('127.0.0.1');
    expect(getNode(renderer, 'ui.base.input:virtual-keyboard')).toBeDefined();
    await act(() => {
      getNode(renderer, 'ui.base.input:virtual-keyboard:complete').props.onPress();
    });
    await act(async () => {
      renderer.unmount();
    });
  });

  it('renders the two goal cards without exposing an identity-query action', async () => {
    const renderer = await mount();
    expect(getNode(renderer, adminTestIds.topology.goalChoice)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.goalHost)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.goalSlave)).toBeDefined();
    expect(renderer.getByText('尚未配对 · 请选择当前机器的用途')).toBeDefined();
    expect(queryNodes(renderer, adminTestIds.topology.operationFeedback)).toHaveLength(0);
    expect(queryNodes(renderer, 'terminal.admin:topology:identity-query')).toHaveLength(0);
    await act(async () => {
      renderer.unmount();
    });
  });

  it('renders host-ready address facts and removes direct pairing input', async () => {
    const readyFacts = {
      ...topologyFacts,
      hostDesired: true,
      hostActual: 'running' as const,
      hostAddress: {host: '192.0.2.10', port: 43172, basePath: '/terminal-topology'},
    };
    const readyContext = {
      ...context,
      topologyCapability: {...topologyCapability, getSnapshot: () => readyFacts},
    } as unknown as AdminSectionProps['context'];
    const renderer = await mount(vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(readyFacts), readyContext);
    expect(getNode(renderer, adminTestIds.topology.hostService)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.hostServiceState)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.hostIp)).toBeDefined();
    expect(queryNodes(renderer, adminTestIds.topology.goalChoice)).toHaveLength(0);
    expect(queryNodes(renderer, adminTestIds.topology.pair)).toHaveLength(0);
    await act(async () => {
      renderer.unmount();
    });
  });

  it('renders typed host failure with a retry action', async () => {
    const failedFacts = {
      ...topologyFacts,
      hostDesired: true,
      hostActual: 'error' as const,
      hostErrorCode: 'TOPOLOGY_HOST_PORT_OCCUPIED',
    };
    const failedContext = {
      ...context,
      topologyCapability: {...topologyCapability, getSnapshot: () => failedFacts},
    } as unknown as AdminSectionProps['context'];
    const renderer = await mount(
      vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(failedFacts),
      failedContext,
    );
    expect(getNode(renderer, adminTestIds.topology.failureReason)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.retry)).toBeDefined();
    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps pair failure as a dedicated recovery frame without goal cards underneath', async () => {
    const pairByHost = vi.fn(async () => ({
      status: 'failed' as const,
      reasonCode: 'TOPOLOGY_HOST_UNREACHABLE' as const,
    }));
    const pairErrorContext = {
      ...context,
      topologyCapability: {...topologyCapability, pairByHost},
    } as unknown as AdminSectionProps['context'];
    const renderer = await mount(undefined, pairErrorContext);
    const input = queryNodesByType(renderer, 'TextInput').find(
      node => node.props.testID === 'terminal.admin:topology:host',
    );
    expect(input).toBeDefined();

    await act(() => {
      input!.props.onPressIn({stopPropagation: () => undefined});
      input!.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    for (const character of '127.0.0.1') {
      await act(() => {
        getNode(renderer, `ui.base.input:virtual-keyboard:text-${character}`).props.onPress();
      });
    }
    await act(async () => {
      getNode(renderer, 'terminal.admin:topology:pair').props.onPress();
      await new Promise(resolve => setTimeout(resolve, 2_900));
    });

    expect(getNode(renderer, adminTestIds.topology.failureReason)).toBeDefined();
    expect(queryNodes(renderer, adminTestIds.topology.goalChoice)).toHaveLength(0);
    expect(getNode(renderer, adminTestIds.topology.retry)).toBeDefined();
    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps paired reconnecting semantics and exposes unpair for both roles', async () => {
    const pairedFacts = {
      ...topologyFacts,
      instanceMode: 'SLAVE' as const,
      displayRole: 'VICE' as const,
      paired: true,
      peerReachable: false,
      peerIdentity: {
        protocolVersion: 1 as const,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-master',
        displayName: '主机',
        instanceMode: 'MASTER' as const,
        displayRole: 'CHIEF' as const,
      },
    };
    const pairedContext = {
      ...context,
      topologyCapability: {...topologyCapability, getSnapshot: () => pairedFacts},
    } as unknown as AdminSectionProps['context'];
    const renderer = await mount(
      vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(pairedFacts),
      pairedContext,
    );
    expect(getNode(renderer, adminTestIds.topology.pairing)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.reachability)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.counterparty)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.pairState)).toBeDefined();
    expect(getNode(renderer, adminTestIds.topology.unpair)).toBeDefined();
    expect(queryNodes(renderer, adminTestIds.topology.goalChoice)).toHaveLength(0);
    expect(queryNodes(renderer, adminTestIds.topology.host)).toHaveLength(0);
    await act(async () => {
      renderer.unmount();
    });
  });

  it('keeps the pairing result bound to owner facts after a successful unpair', async () => {
    const pairedFacts = {
      ...topologyFacts,
      paired: true,
      peerReachable: true,
      peerIdentity: {
        protocolVersion: 1 as const,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-slave',
        displayName: '副机',
        instanceMode: 'SLAVE' as const,
        displayRole: 'VICE' as const,
      },
    };
    const unpairedFacts = {...topologyFacts};
    let currentFacts = pairedFacts;
    const unpair = vi.fn(async () => {
      currentFacts = unpairedFacts;
      return {status: 'completed' as const};
    });
    const pairedContext = {
      ...context,
      topologyCapability: {
        ...topologyCapability,
        getSnapshot: () => currentFacts,
        unpair,
      },
    } as unknown as AdminSectionProps['context'];
    const selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockImplementation(() => currentFacts);
    const renderer = await mount(selectorSpy, pairedContext);

    await act(async () => {
      getNode(renderer, adminTestIds.topology.unpair).props.onPress();
      await new Promise(resolve => setTimeout(resolve, 2_400));
    });

    expect(renderer.getByText('尚未配对 · 请选择当前机器的用途')).toBeDefined();
    expect(renderer.getByText('解绑提交完成，等待状态同步')).toBeDefined();
    await act(async () => {
      renderer.unmount();
    });
  });

  it('subscribes to owner topology facts instead of reading a private state selector', async () => {
    const selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(topologyFacts);
    const renderer = await mount(selectorSpy);
    expect(selectorSpy).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    await act(async () => {
      renderer.unmount();
    });
  });

  it('submits the entered host directly through the owner capability', async () => {
    const renderer = await mount();
    const input = queryNodesByType(renderer, 'TextInput').find(
      node => node.props.testID === 'terminal.admin:topology:host',
    );
    expect(input).toBeDefined();

    await act(() => {
      input!.props.onPressIn({stopPropagation: () => undefined});
      input!.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    for (const character of '127.0.0.1') {
      await act(() => {
        getNode(renderer, `ui.base.input:virtual-keyboard:text-${character}`).props.onPress();
      });
    }
    await act(async () => {
      getNode(renderer, 'terminal.admin:topology:pair').props.onPress();
      await new Promise(resolve => setTimeout(resolve, 850));
    });

    expect(topologyCapability.pairByHost).toHaveBeenCalledWith({host: '127.0.0.1'});
    await act(async () => {
      renderer.unmount();
    });
  });

  it('renders one page gate and no topology action when the owner denies the page', async () => {
    const getOperationEligibility = vi.fn((operation: string) => ({
      operation,
      allowed: true,
      reasonCode: 'allowed' as const,
    }));
    const unavailableContext = {
      ...context,
      topologyCapability: {
        ...topologyCapability,
        getOperationEligibility,
        getPageAvailability: () => ({
          available: false as const,
          reasonCode: 'TOPOLOGY_REQUIRES_SINGLE_SCREEN' as const,
        }),
      },
    } as unknown as AdminSectionProps['context'];
    const renderer = await mount(undefined, unavailableContext);

    expect(getNode(renderer, 'terminal.admin:topology:page-gate')).toBeDefined();
    expect(renderer.getByLabelText('功能不可用')).toBeDefined();
    expect(renderer.getByText('当前功能不可用')).toBeDefined();
    expect(renderer.getByText('双机拓扑要求本机只有一个物理屏')).toBeDefined();
    expect(getNode(renderer, 'terminal.admin:topology:page-gate').props.style).toEqual(
      expect.objectContaining({justifyContent: 'center'}),
    );
    expect(getNode(renderer, 'terminal.admin:topology:page-gate-reason').props.style).toEqual(
      expect.objectContaining({textAlign: 'center'}),
    );
    expect(queryNodes(renderer, 'terminal.admin:topology:host')).toHaveLength(0);
    expect(queryNodes(renderer, 'terminal.admin:topology:pair')).toHaveLength(0);
    expect(queryNodes(renderer, 'terminal.admin:topology:unpair')).toHaveLength(0);
    expect(queryNodes(renderer, adminTestIds.topology.hostService)).toHaveLength(0);
    expect(queryNodes(renderer, adminTestIds.topology.pairing)).toHaveLength(0);
    expect(queryNodes(renderer, adminTestIds.topology.counterparty)).toHaveLength(0);
    expect(queryNodes(renderer, adminTestIds.topology.displayCount)).toHaveLength(0);
    expect(getOperationEligibility).not.toHaveBeenCalled();
    await act(async () => {
      renderer.unmount();
    });
  });

  it('hides target selection and host action after the owner reports a paired slave', async () => {
    const pairedSlaveFacts = {
      ...topologyFacts,
      instanceMode: 'SLAVE' as const,
      displayRole: 'VICE' as const,
      paired: true,
      peerReachable: true,
    };
    const pairedSlaveContext = {
      ...context,
      topologyCapability: {
        ...topologyCapability,
        getSnapshot: () => pairedSlaveFacts,
      },
    } as unknown as AdminSectionProps['context'];
    const selectorSpy = vi.spyOn(renderHooks, 'useUiStateSelector').mockReturnValue(pairedSlaveFacts);
    const renderer = await mount(selectorSpy, pairedSlaveContext);

    expect(queryNodes(renderer, 'terminal.admin:topology:host')).toHaveLength(0);
    expect(queryNodes(renderer, 'terminal.admin:topology:pair')).toHaveLength(0);
    expect(getNode(renderer, 'terminal.admin:topology:unpair')).toBeDefined();
    expect(queryNodes(renderer, 'terminal.admin:topology:enable')).toHaveLength(0);
    await act(async () => {
      renderer.unmount();
    });
  });
});
