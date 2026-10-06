import {inputTestIds} from '@catering-v2s/ui-base-input/test-ids';
import {act, render, type RenderResult} from '@testing-library/react-native';
import {createElement, cloneElement, type ReactElement, type ReactNode} from 'react';
import {renderHook} from '@testing-library/react-native';
import {ScrollView, StyleSheet, TextInput, View} from 'react-native';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {
  LogEvent,
  LogWriteInput,
  LogWriteResult,
  LoggerPort,
  NativeLoadingCapability,
} from '@catering-v2s/kernel-base-platform-ports';
import {createRequestId, type TopologyLocator} from '@catering-v2s/kernel-base-contracts';
import type {CommandDispatchResult, Runtime} from '@catering-v2s/kernel-base-runtime';
import {createDisplayContextModule} from '@catering-v2s/kernel-base-display-context';
import {createTransportModule} from '@catering-v2s/kernel-base-transport';
import {createTopologyModule, topologyActions, topologyHostEventCommand} from '@catering-v2s/kernel-base-topology';
import {createSampleStaffSessionModule} from '@catering-v2s/kernel-feature-sample-staff-session';
import {createSampleMemberRegistryModule} from '@catering-v2s/kernel-feature-sample-member-registry';
import {
  createRendererCatalog,
  createRenderRuntimeFacts,
  RenderProvider as ActualRenderProvider,
} from '@catering-v2s/ui-base-render';
import {InputSurfaceFrame} from '@catering-v2s/ui-base-input';
import {
  advanceAnimatedTimingsForTests,
  setAnimatedTimingAutoFinishForTests,
} from '../../../../../../tools/terminal-shared/react-native-vitest-entry';
import type {RenderProviderProps} from '@catering-v2s/ui-base-render';
import {createUiCatalog, createUiStateModule, selectLayers, selectScreen} from '@catering-v2s/kernel-base-ui-state';
import {sampleMemberDeskAssembly, startMemberDeskCommand} from '../src/index';
import {createSampleMemberDeskModule} from '../src/application/module';
import {CustomerMember} from '../src/components/laptop/CustomerMember';
import {DeskSystemNotice} from '../src/components/laptop/DeskSystemNotice';
import {DeskSystemNotice as MobileDeskSystemNotice} from '../src/components/mobile/DeskSystemNotice';
import {MemberList} from '../src/components/laptop/MemberList';
import {MemberForm} from '../src/components/laptop/MemberForm';
import {BranchLaptopMemberList} from '../src/components/branch/MemberList';
import {BranchLaptopCustomerMember} from '../src/components/branch/CustomerMember';
import {RegistryNotice} from '../src/components/laptop/RegistryNotice';
import {WaitingConfirm} from '../src/components/laptop/WaitingConfirm';
import {
  confirmMemberCommand,
  memberConfirmedCommand,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry';
import {memberActions as memberStateActions} from '../../../../kernel/feature/sample-member-registry/src/features/slices/slice';
import {
  deskSystemFailureDismissedCommand,
  deskSystemFailureObservedCommand,
  memberFormOpenedCommand,
} from '../src/features/commands/commands';
import {createTestRuntime} from '../../../../kernel/feature/sample-member-registry/test/support';
import {releaseRuntimeForTestAsync} from '../../../../kernel/base/runtime/src/testing';
import {setDisplayRoleAction} from '../../../../kernel/base/display-context/src/features/slices/displayRole';
import {setRuntimeInstanceModeAction} from '../../../../kernel/base/runtime/src/features/slices/runtimeInstanceMode';
import {useCustomerMember} from '../src/hooks/useCustomerMember';
import {deriveSampleMemberDeskTestId, sampleMemberDeskTestId} from '../src/foundations/sampleMemberDeskTestIds';
import {
  resetNativeTestRefFactory,
  setNativeTestRefFactory,
  withNativeTestHosts,
  type NativeTestHostProps,
} from '../../../../../../tools/terminal-shared/rntl-native-test-host';
import {
  getRenderedByProps,
  queryRenderedByProps,
  queryRenderedByType,
  queryRenderedTree,
  queryRenderedSubtree,
  getRenderedDescendantByProps,
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

type RuntimeStateRoot = ReturnType<Runtime['getState']>;
const nativeLoadingCapability: NativeLoadingCapability = Object.freeze({
  targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY', displayIndex: 0}),
  hideOnce: async reason => Object.freeze({hidden: true, alreadyHidden: false, reason}),
});
const RenderProvider = ActualRenderProvider as unknown as (
  props: Omit<RenderProviderProps, 'runtimeFacts' | 'nativeLoadingCapability'> &
    Readonly<{
      readonly runtimeFacts?: RenderProviderProps['runtimeFacts'];
    }>,
) => ReactElement | null;
type TestInstanceQuery = RenderedTestInstance;

type TextInputTestInstance = Readonly<{
  readonly props: Readonly<{
    readonly testID?: unknown;
    readonly maxLength?: unknown;
    readonly value?: unknown;
    readonly onFocus: (event: Readonly<{readonly nativeEvent: Readonly<Record<string, never>>}>) => void;
    readonly onChangeText: (value: string) => void;
  }>;
}>;

type FrameLayout = Readonly<{readonly width: number; readonly height: number}>;
type ScrollFieldProof = Readonly<{readonly scrollTestID: string; readonly fieldIds: readonly string[]}>;

const defaultScrollContentByID = new Map<string, object>();
const defaultScrollByFieldID = new Map<string, string>([
  [sampleMemberDeskTestId('sample.desk.member-form:name'), sampleMemberDeskTestId('sample.desk.member-form:scroll')],
  [sampleMemberDeskTestId('sample.desk.member-form:phone'), sampleMemberDeskTestId('sample.desk.member-form:scroll')],
  [
    sampleMemberDeskTestId('sample.desk.member-form:keyboard-alpha-probe'),
    sampleMemberDeskTestId('sample.desk.member-form:scroll'),
  ],
  [
    sampleMemberDeskTestId('sample.desk.member-form:keyboard-financial-probe'),
    sampleMemberDeskTestId('sample.desk.member-form:scroll'),
  ],
  [
    sampleMemberDeskTestId('sample.desk.customer-member:age'),
    sampleMemberDeskTestId('sample.desk.customer-member:scroll'),
  ],
]);
const defaultScrollIDs = new Set<string>(defaultScrollByFieldID.values());

const createDefaultInputNodeMock =
  (frameLayout: FrameLayout) =>
  (_hostName: string, props: NativeTestHostProps): unknown => {
    const testID = props.testID;
    if (testID === inputTestIds.node('surface-frame')) return {};
    if (typeof testID === 'string' && defaultScrollIDs.has(testID)) {
      const contentNode = {};
      defaultScrollContentByID.set(testID, contentNode);
      return {
        getInnerViewRef: () => contentNode,
        measureLayout: (
          _relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          callback(0, 0, frameLayout.width, Math.max(1, frameLayout.height - 20));
        },
        scrollTo: () => undefined,
      };
    }
    if (typeof testID === 'string') {
      const scrollID = defaultScrollByFieldID.get(testID);
      if (scrollID === undefined) return {};
      return {
        measureLayout: (
          relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          expect(relativeTo).toBe(defaultScrollContentByID.get(scrollID));
          callback(0, 120, Math.min(320, frameLayout.width), 40);
        },
        focus: () => undefined,
        blur: () => undefined,
      };
    }
    return {};
  };

const findTextInput = (renderer: RenderResult, testID: string): TextInputTestInstance => {
  const input = queryRenderedByType(renderer, 'TextInput').find(
    node => node.props.testID === sampleMemberDeskTestId(testID),
  ) as unknown as TextInputTestInstance | undefined;
  if (input === undefined) throw new Error(`Missing TextInput ${testID}`);
  return input;
};

const press = (renderer: RenderResult, testID: string): (() => unknown) => {
  const instance = getRenderedByProps(renderer, {testID}) as unknown as Readonly<{
    readonly props: Readonly<{readonly onPress: () => unknown}>;
  }>;
  return instance.props.onPress;
};

const createLogger = (): Readonly<{readonly logger: LoggerPort; readonly events: LogWriteInput[]}> => {
  const events: LogWriteInput[] = [];
  const write = (input: LogWriteInput): LogWriteResult => {
    events.push(input);
    return {status: 'succeeded', value: {} as LogEvent, completedAt: 0};
  };
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  };
  return {logger, events};
};

const createStateSource = (root: RuntimeStateRoot) => ({
  getStatus: () => 'started' as const,
  getState: () => root,
  subscribe: (_listener: () => void) => () => undefined,
});

const mount = async (
  element: ReturnType<typeof createElement>,
  frameLayout: FrameLayout = {width: 1280, height: 800},
  nativeRefFactory?: (hostName: string, props: NativeTestHostProps) => unknown,
): Promise<RenderResult> => {
  const wrappedElement = cloneElement(element as ReactElement<RenderProviderProps>, {
    runtimeFacts: createRenderRuntimeFacts({
      environmentMode: 'DEV',
      debugMode: {enabled: true, source: 'startup'},
      deviceIdentity: {available: false, deviceId: null},
      platformPortCapabilities: [],
    }),
    nativeLoadingCapability,
  });
  defaultScrollContentByID.clear();
  setNativeTestRefFactory(nativeRefFactory ?? createDefaultInputNodeMock(frameLayout));
  const renderer = await render(wrappedElement);
  const frames = queryRenderedByProps(renderer, {testID: inputTestIds.node('surface-frame')});
  await act(async () => {
    for (const frame of frames) {
      (frame.props.onLayout as (event: unknown) => void)({nativeEvent: {layout: frameLayout}});
    }
  });
  if (nativeRefFactory === undefined) {
    const scrollAreas = queryRenderedTree(renderer, node => true).filter(
      node =>
        typeof node.props.testID === 'string' &&
        defaultScrollIDs.has(node.props.testID as string) &&
        typeof node.props.onLayout === 'function' &&
        typeof node.props.onContentSizeChange === 'function' &&
        typeof node.props.onScroll === 'function',
    );
    await act(async () => {
      for (const scroll of scrollAreas) {
        (scroll.props.onLayout as (event: unknown) => void)({
          nativeEvent: {
            layout: {
              x: 0,
              y: 0,
              width: frameLayout.width,
              height: Math.max(1, frameLayout.height - 20),
            },
          },
        });
        (scroll.props.onContentSizeChange as (width: number, height: number) => void)(frameLayout.width, 1200);
        (scroll.props.onScroll as (event: unknown) => void)({nativeEvent: {contentOffset: {y: 0}}});
      }
    });
  }
  return renderer;
};

const createScrollFieldNodeMock = (
  surfaceRoot: object,
  proofs: readonly ScrollFieldProof[],
  measuredFields: Array<Readonly<{readonly fieldId: string; readonly relativeTo: unknown}>>,
): ((hostName: string, props: NativeTestHostProps) => unknown) => {
  const contentByScrollID = new Map<string, object>();
  const scrollIDByFieldID = new Map<string, string>();
  for (const proof of proofs) {
    const scrollTestID = sampleMemberDeskTestId(proof.scrollTestID);
    for (const fieldId of proof.fieldIds) scrollIDByFieldID.set(sampleMemberDeskTestId(fieldId), scrollTestID);
  }
  return (hostName, props) => {
    const testID = props.testID;
    if (hostName === 'View' && testID === inputTestIds.node('surface-frame')) return surfaceRoot;
    if (
      hostName === 'ScrollView' &&
      typeof testID === 'string' &&
      proofs.some(proof => sampleMemberDeskTestId(proof.scrollTestID) === testID)
    ) {
      const contentNode = {};
      contentByScrollID.set(testID, contentNode);
      return {
        getInnerViewRef: () => contentNode,
        measureLayout: (
          relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          expect(relativeTo).toBe(surfaceRoot);
          callback(0, 0, 1280, 780);
        },
        scrollTo: () => undefined,
      };
    }
    if (typeof testID === 'string' && scrollIDByFieldID.has(testID)) {
      const fieldId = testID;
      const scrollID = scrollIDByFieldID.get(fieldId)!;
      return {
        measureLayout: (
          relativeTo: unknown,
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => {
          measuredFields.push({fieldId, relativeTo});
          expect(relativeTo).toBe(contentByScrollID.get(scrollID));
          callback(0, 500, 320, 40);
        },
        focus: () => undefined,
        blur: () => undefined,
      };
    }
    return {};
  };
};

const initializeScrollArea = async (
  renderer: RenderResult,
  testID: string,
  width = 1280,
  height = 780,
): Promise<void> => {
  const props = queryRenderedByProps(renderer, {testID: sampleMemberDeskTestId(testID)}).find(
    node =>
      typeof node.props.onLayout === 'function' &&
      typeof node.props.onContentSizeChange === 'function' &&
      typeof node.props.onScroll === 'function',
  )?.props;
  if (props === undefined) throw new Error(`Missing native scroll view callbacks for ${testID}`);
  await act(async () => {
    (props.onLayout as (event: unknown) => void)({nativeEvent: {layout: {x: 0, y: 0, width, height}}});
    (props.onContentSizeChange as (contentWidth: number, contentHeight: number) => void)(width, 1200);
    (props.onScroll as (event: unknown) => void)({nativeEvent: {contentOffset: {y: 0}}});
  });
};

const measureKeyboardLayers = async (renderer: RenderResult): Promise<void> => {
  const measurementLayers = queryRenderedByProps(renderer, {
    testID: inputTestIds.node('keyboard-layer-position:measure'),
  });
  for (const layer of measurementLayers) {
    const backdrop = getRenderedDescendantByProps(layer, {testID: inputTestIds.node('virtual-keyboard:backdrop')});
    const layout = StyleSheet.flatten(backdrop.props.style) as Readonly<{
      readonly width: number;
      readonly height: number;
    }>;
    const onLayout = layer.props.onLayout;
    if (typeof onLayout !== 'function') throw new Error('Keyboard measurement layer is missing its onLayout callback');
    await act(async () => {
      (onLayout as (event: unknown) => void)({nativeEvent: {layout}});
    });
  }
};

const finishKeyboardPresentation = async (renderer: RenderResult): Promise<void> => {
  setAnimatedTimingAutoFinishForTests(true);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (queryRenderedByProps(renderer, {testID: inputTestIds.node('keyboard-layer-position:measure')}).length === 0)
      break;
    await measureKeyboardLayers(renderer);
    await act(async () => {
      advanceAnimatedTimingsForTests(1);
    });
  }
};

const withInputSurface = (element: ReturnType<typeof createElement>) => createElement(InputSurfaceFrame, {}, element);

const expectTextValue = (renderer: RenderResult, testID: string, value: string): void => {
  expect(
    queryRenderedByProps(renderer, {testID}).some(
      node =>
        node.children
          ?.filter((child): child is string => typeof child === 'string')
          .join('')
          .includes(value) ?? false,
    ),
  ).toBe(true);
};

const expectTextAbsent = (renderer: RenderResult, value: string): void => {
  expect(
    queryRenderedByProps(renderer, {testID: deriveSampleMemberDeskTestId('sample.desk.system-notice', 'message')}).some(
      node =>
        node.children
          ?.filter((child): child is string => typeof child === 'string')
          .join('')
          .includes(value) ?? false,
    ),
  ).toBe(false);
};

const memberRoot = (
  pending: Readonly<{name: string; phone: string}>,
  members: readonly Readonly<{
    memberId: string;
    operationId: string;
    name: string;
    phone: string;
    registeredAt: number;
  }>[] = [],
  instanceMode: 'MASTER' | 'SLAVE' = 'MASTER',
): RuntimeStateRoot => {
  const hostPending = Object.freeze({operationId: `operation:${pending.phone}`, ...pending});
  return Object.freeze({
    'kernel.base.runtime.instance-mode': Object.freeze({instanceMode}),
    'kernel.base.display-context.display-role': Object.freeze({
      displayRole: instanceMode === 'MASTER' ? 'CHIEF' : 'VICE',
    }),
    'kernel.feature.sample-member-registry.members': Object.freeze({
      members: Object.freeze(members),
      hostPending: instanceMode === 'MASTER' ? hostPending : null,
      branchPending: null,
      ...(instanceMode === 'SLAVE' ? {hostPendingProjection: hostPending} : {}),
    }),
  }) as RuntimeStateRoot;
};

const completedResult = (): CommandDispatchResult => ({
  requestId: null,
  commandId: 'command_test' as never,
  status: 'completed',
  actorResults: [],
});

const resultWithActors = (
  status: CommandDispatchResult['status'],
  actorResults: readonly object[],
): CommandDispatchResult => ({
  requestId: null,
  commandId: 'command_test' as never,
  status,
  actorResults: actorResults as CommandDispatchResult['actorResults'],
});

const actorFailure = (category: 'SYSTEM' | 'BUSINESS'): object => ({
  actorKey: 'sample-test-actor',
  status: 'error',
  startedAt: 0,
  completedAt: 1,
  result: null,
  error: {
    key: 'sample-test-error',
    code: 'ERR_SAMPLE_TEST',
    message: 'test failure',
    category,
    severity: 'error',
  },
});

const runningActor = (): object => ({
  actorKey: 'sample-test-actor',
  status: 'running',
  startedAt: 0,
  completedAt: null,
  result: null,
  error: null,
});

describe('sample member desk UI feature', () => {
  it('exports laptop/mobile renderer siblings with exact metadata and no transient variables', async () => {
    const expectedPair = (
      part: Readonly<{
        readonly partKey: string;
        readonly containerKeys: readonly string[];
        readonly displayModes: readonly string[];
        readonly workspaces: readonly string[];
        readonly instanceModes: readonly string[];
        readonly title: string;
        readonly layerTier: 'standard' | 'alert';
        readonly layerGuard: 'dismissible' | 'decisive';
      }>,
    ) =>
      (['laptop', 'mobile'] as const).map(surfaceForm => ({
        ...part,
        rendererKey: `${part.partKey}.${surfaceForm}`,
        surfaceForm: [surfaceForm],
      }));
    const metadata = sampleMemberDeskAssembly.parts.map(({catalogEntry, rendererBinding}) => ({
      partKey: catalogEntry.partKey,
      rendererKey: catalogEntry.rendererKey,
      containerKeys: [...catalogEntry.containerKeys],
      displayModes: [...catalogEntry.displayModes],
      workspaces: [...catalogEntry.workspaces],
      instanceModes: [...catalogEntry.instanceModes],
      title: catalogEntry.title,
      surfaceForm: [...catalogEntry.surfaceForm],
      layerTier: rendererBinding.layerTier,
      layerGuard: rendererBinding.layerGuard,
    }));
    expect(metadata).toEqual([
      ...expectedPair({
        partKey: 'sample.desk.branch.member-list',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '已登记会员',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.branch.member-form',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '新增会员',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.branch.customer-member',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '顾客会员确认',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.branch.registry-notice',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '登记结果提示',
        layerTier: 'alert',
        layerGuard: 'decisive',
      }),
      ...expectedPair({
        partKey: 'sample.desk.branch.discard-confirm',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '放弃草稿确认',
        layerTier: 'alert',
        layerGuard: 'decisive',
      }),
      ...expectedPair({
        partKey: 'sample.desk.branch.withdraw-confirm',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '撤回登记确认',
        layerTier: 'alert',
        layerGuard: 'decisive',
      }),
      ...expectedPair({
        partKey: 'sample.desk.branch.system-notice',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        title: '系统失败提示',
        layerTier: 'alert',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.member-list',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '已登记会员',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.member-form',
        containerKeys: ['main'],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '新增会员',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.waiting-confirm',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '等待顾客确认',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.registry-notice',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '登记结果提示',
        layerTier: 'alert',
        layerGuard: 'decisive',
      }),
      ...expectedPair({
        partKey: 'sample.desk.discard-confirm',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '放弃草稿确认',
        layerTier: 'alert',
        layerGuard: 'decisive',
      }),
      ...expectedPair({
        partKey: 'sample.desk.withdraw-confirm',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '撤回登记确认',
        layerTier: 'alert',
        layerGuard: 'decisive',
      }),
      ...expectedPair({
        partKey: 'sample.desk.system-notice',
        containerKeys: [],
        displayModes: ['PRIMARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER'],
        title: '系统失败提示',
        layerTier: 'alert',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.customer-welcome',
        containerKeys: ['main'],
        displayModes: ['SECONDARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        title: '顾客欢迎页',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
      ...expectedPair({
        partKey: 'sample.desk.customer-member',
        containerKeys: ['main'],
        displayModes: ['PRIMARY', 'SECONDARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        title: '顾客会员确认',
        layerTier: 'standard',
        layerGuard: 'dismissible',
      }),
    ]);
    expect(sampleMemberDeskAssembly).not.toHaveProperty('variables');
  });

  it('uses the topology secondary fact for member navigation on a paired single-screen master', async () => {
    const catalog = createUiCatalog(
      sampleMemberDeskAssembly.parts
        .filter(part => part.catalogEntry.surfaceForm.includes('laptop'))
        .map(part => part.catalogEntry),
    );
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({
        displayName: 'sample member desk topology test',
        moduleName: 'ui.integration.sample-console',
        surfaceForm: 'laptop',
      }),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ]);
    const locator: TopologyLocator = {
      host: '192.0.2.60',
      port: 43172,
      basePath: '/terminal-topology',
      identity: {
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-member-desk-peer',
        displayName: 'Peer',
        instanceMode: 'SLAVE',
        displayRole: 'VICE',
      },
    };
    try {
      await runtime.start();
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator));
      runtime.getStore().dispatch(setRuntimeInstanceModeAction('MASTER'));
      runtime.getStore().dispatch(setDisplayRoleAction('CHIEF'));
      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toBeUndefined();
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toBeUndefined();
      await runtime.dispatchCommand(
        startMemberDeskCommand,
        {},
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
        },
      );
      await runtime.dispatchCommand(
        startMemberDeskCommand,
        {},
        {
          requestId: createRequestId(),
          routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'SECONDARY'},
        },
      );
      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toMatchObject({partKey: 'sample.desk.member-list'});
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-welcome',
      });
      const operationId = createRequestId();
      await runtime.dispatchCommand(
        submitMemberCommand,
        {name: 'LMS member', phone: '010-1234-5678'},
        {requestId: operationId},
      );
      const confirmed = await runtime.dispatchCommand(
        confirmMemberCommand,
        {operationId: String(operationId)},
        {requestId: createRequestId()},
      );
      expect(confirmed.status).toBe('completed');
      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toMatchObject({partKey: 'sample.desk.member-list'});
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toMatchObject({
        partKey: 'sample.desk.customer-welcome',
      });
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });

  it('keeps the customer surface on a paired single-screen slave before staff login', async () => {
    const catalog = createUiCatalog(
      sampleMemberDeskAssembly.parts
        .filter(part => part.catalogEntry.surfaceForm.includes('laptop'))
        .map(part => part.catalogEntry),
    );
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({
        displayName: 'sample member desk slave topology test',
        moduleName: 'ui.integration.sample-console',
        surfaceForm: 'laptop',
      }),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ]);
    const locator: TopologyLocator = {
      host: '192.0.2.61',
      port: 43172,
      basePath: '/terminal-topology',
      identity: {
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-member-desk-master',
        displayName: 'Master',
        instanceMode: 'MASTER',
        displayRole: 'CHIEF',
      },
    };
    try {
      await runtime.start();
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator));
      // This fixture represents the persisted single-screen slave boundary;
      // the display-context command path owns validation of these values.
      runtime.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      runtime.getStore().dispatch(setDisplayRoleAction('VICE'));
      const result = await runtime.dispatchCommand(
        topologyHostEventCommand,
        {event: 'peer-accepted'},
        {requestId: createRequestId()},
      );
      expect(result.status).toBe('completed');
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toBeUndefined();
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });

  it('keeps SLAVE VICE from writing host-owned screen placement during state-transfer recovery', async () => {
    const catalog = createUiCatalog(
      sampleMemberDeskAssembly.parts
        .filter(part => part.catalogEntry.surfaceForm.includes('laptop'))
        .map(part => part.catalogEntry),
    );
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({
        displayName: 'sample member desk recovered state test',
        moduleName: 'ui.integration.sample-console',
        surfaceForm: 'laptop',
      }),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ]);
    const locator: TopologyLocator = {
      host: '192.0.2.62',
      port: 43172,
      basePath: '/terminal-topology',
      identity: {
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-member-desk-recovered-state',
        displayName: 'Master',
        instanceMode: 'MASTER',
        displayRole: 'CHIEF',
      },
    };
    try {
      await runtime.start();
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator));
      runtime.getStore().dispatch(topologyActions.setDisplayCount(2));
      runtime.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      runtime.getStore().dispatch(setDisplayRoleAction('VICE'));

      runtime.getStore().dispatch(
        memberStateActions.setBranchPending({
          operationId: 'branch-operation',
          name: 'Branch Alice',
          phone: '010-0000-0000',
        }),
      );
      const pendingResult = await runtime.dispatchCommand(
        topologyHostEventCommand,
        {event: 'state-transfer-recovered'},
        {requestId: createRequestId()},
      );
      expect(pendingResult.status).toBe('completed');
      expect(selectScreen(runtime.getState(), 'SECONDARY', 'main')).toBeUndefined();
      expect(
        (
          runtime.getState()['kernel.feature.sample-member-registry.members'] as {
            readonly branchPending: {readonly operationId: string};
          }
        ).branchPending.operationId,
      ).toBe('branch-operation');
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });

  it('stores completed branch navigation while VICE is showing the host projection', async () => {
    const catalog = createUiCatalog(
      sampleMemberDeskAssembly.parts
        .filter(part => part.catalogEntry.surfaceForm.includes('laptop'))
        .map(part => part.catalogEntry),
    );
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({
        displayName: 'sample member desk VICE completion test',
        moduleName: 'ui.integration.sample-console',
        surfaceForm: 'laptop',
      }),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ]);
    try {
      await runtime.start();
      runtime.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      runtime.getStore().dispatch(setDisplayRoleAction('VICE'));
      runtime.getStore().dispatch(
        memberStateActions.registerConfirmedMember({
          memberId: 'branch-operation-9',
          operationId: 'branch-operation-9',
          name: 'Branch guest',
          phone: '010-9999-9999',
          registeredAt: 1,
        }),
      );

      await runtime.dispatchCommand(
        memberConfirmedCommand,
        {memberId: 'branch-operation-9'},
        {requestId: createRequestId()},
      );
      runtime.getStore().dispatch(setDisplayRoleAction('CHIEF'));

      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.branch.member-list',
      });
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });

  it('routes the paired branch member desk from list to local form and local confirmation', async () => {
    const catalog = createUiCatalog(
      sampleMemberDeskAssembly.parts
        .filter(part => part.catalogEntry.surfaceForm.includes('laptop'))
        .map(part => part.catalogEntry),
    );
    const runtime = createTestRuntime([
      createDisplayContextModule(),
      createTransportModule(),
      createTopologyModule({
        displayName: 'sample branch member desk test',
        moduleName: 'ui.integration.sample-console',
        surfaceForm: 'laptop',
      }),
      createUiStateModule({catalog, variables: [], surfaceForm: 'laptop'}),
      createSampleStaffSessionModule(),
      createSampleMemberRegistryModule(),
      createSampleMemberDeskModule(),
    ]);
    const locator: TopologyLocator = {
      host: '192.0.2.63',
      port: 43172,
      basePath: '/terminal-topology',
      identity: {
        protocolVersion: 1,
        moduleName: 'ui.integration.sample-console',
        nodeId: 'node-member-desk-branch',
        displayName: 'Master',
        instanceMode: 'MASTER',
        displayRole: 'CHIEF',
      },
    };
    try {
      await runtime.start();
      runtime.getStore().dispatch(topologyActions.setMasterLocator(locator));
      runtime.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      runtime.getStore().dispatch(setDisplayRoleAction('CHIEF'));

      const started = await runtime.dispatchCommand(startMemberDeskCommand, {}, {requestId: createRequestId()});
      expect(started.status).toBe('completed');
      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.branch.member-list',
      });

      await runtime.dispatchCommand(memberFormOpenedCommand, {}, {requestId: createRequestId()});
      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.branch.member-form',
      });

      await runtime.dispatchCommand(
        submitMemberCommand,
        {name: 'Branch member', phone: '010-1234-9876'},
        {requestId: 'branch-operation-1' as never},
      );
      expect(selectScreen(runtime.getState(), 'PRIMARY', 'main')).toMatchObject({
        partKey: 'sample.desk.branch.customer-member',
      });
      expect(
        (runtime.getState()['kernel.feature.sample-member-registry.members'] as {readonly branchPending: unknown})
          .branchPending,
      ).toMatchObject({operationId: 'branch-operation-1', name: 'Branch member', phone: '010-1234-9876'});
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });

  it('renders the branch member projection without logout and keeps its decision on the local registry owner', async () => {
    const {logger} = createLogger();
    const dispatched: Array<Readonly<{name: string; payload: unknown; target: string | undefined}>> = [];
    const dispatchCommand = ((command, options) => {
      dispatched.push({name: command.definition.commandName, payload: command.payload, target: options.target});
      return Promise.resolve(completedResult());
    }) as RenderProviderProps['dispatchCommand'];
    const branchPending = Object.freeze({operationId: 'branch-op-7', name: 'Branch guest', phone: '010-7777-8888'});
    const root = Object.freeze({
      'kernel.base.runtime.instance-mode': Object.freeze({instanceMode: 'SLAVE'}),
      'kernel.base.display-context.display-role': Object.freeze({displayRole: 'CHIEF'}),
      'kernel.feature.sample-member-registry.members': Object.freeze({
        members: Object.freeze([
          {
            memberId: 'host-member-1',
            operationId: 'host-member-1',
            name: 'Host guest',
            phone: '010-1111-2222',
            registeredAt: 1,
          },
        ]),
        hostPending: null,
        branchPending,
        hostPendingProjection: null,
      }),
    }) as RuntimeStateRoot;
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(root),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(BranchLaptopMemberList),
      ),
    );
    const branchList = queryRenderedByType(renderer, 'VirtualizedList').find(
      node => node.props.testID === sampleMemberDeskTestId('sample.desk.branch.member-list:scroll'),
    );
    expect(branchList).toBeDefined();
    expect((branchList!.props.data as readonly {memberId: string}[]).map(member => member.memberId)).toEqual([
      'host-member-1',
    ]);
    expect(
      queryRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.branch.member-list:logout')}),
    ).toHaveLength(0);
    await act(async () => {
      await renderer.unmount();
    });

    const customerRenderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(root),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(BranchLaptopCustomerMember)),
      ),
    );
    expectTextValue(
      customerRenderer,
      sampleMemberDeskTestId('sample.desk.branch.customer-member:name'),
      'Branch guest',
    );
    expectTextValue(
      customerRenderer,
      sampleMemberDeskTestId('sample.desk.branch.customer-member:phone'),
      '010-7777-8888',
    );
    expect(
      getRenderedByProps(customerRenderer, {
        testID: sampleMemberDeskTestId('sample.desk.branch.customer-member:confirm'),
      }),
    ).toBeDefined();
    expect(
      getRenderedByProps(customerRenderer, {
        testID: sampleMemberDeskTestId('sample.desk.branch.customer-member:reject'),
      }),
    ).toBeDefined();
    await act(async () => {
      await press(customerRenderer, sampleMemberDeskTestId('sample.desk.branch.customer-member:confirm'))();
    });
    expect(dispatched).toContainEqual({
      name: confirmMemberCommand.commandName,
      payload: {operationId: 'branch-op-7'},
      target: 'local',
    });
    await act(async () => {
      await customerRenderer.unmount();
    });
  });

  it('reads confirm data through the owner selector and renders the two actions', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => ({
            requestId: null,
            commandId: 'command_test' as never,
            status: 'completed' as const,
            actorResults: [],
          })) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
      ),
    );

    expectTextValue(renderer, sampleMemberDeskTestId('sample.desk.customer-member:name'), 'Alice');
    expectTextValue(renderer, sampleMemberDeskTestId('sample.desk.customer-member:phone'), '010-1234-5678');
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:reject')}),
    ).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('renders the single-surface hand-back action only for handheld-confirm', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'handheld-confirm'})),
      ),
    );

    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:reject')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:hand-back')}),
    ).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it.each([
    ['landscape confirm', 'confirm', {width: 1280, height: 800}],
    ['portrait handheld-confirm', 'handheld-confirm', {width: 360, height: 720}],
  ] as const)(
    'keeps the customer numeric input actionable in the %s local frame',
    async (_label, mode, frameLayout) => {
      const {logger} = createLogger();
      const renderer = await mount(
        createElement(
          RenderProvider,
          {
            stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
            uiCatalog: createUiCatalog([]),
            rendererCatalog: createRendererCatalog([]),
            logger,
            dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
            selectUiVariable: (_root, declaration) => declaration.defaultValue,
          },
          withInputSurface(createElement(CustomerMember, {mode})),
        ),
        frameLayout,
      );

      const ageInput = findTextInput(renderer, sampleMemberDeskTestId('sample.desk.customer-member:age'));
      await act(async () => {
        ageInput.props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(renderer);
      expect(getRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard:text-1')})).toBeDefined();
      expect(
        getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm')}),
      ).toBeDefined();
      expect(
        getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:reject')}),
      ).toBeDefined();
      if (mode === 'handheld-confirm') {
        expect(
          getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:hand-back')}),
        ).toBeDefined();
      }
      await act(async () => {
        await renderer.unmount();
      });
    },
  );

  it('keeps customer age local, exposes the virtual keyboard, and sends an optional age snapshot', async () => {
    const root = memberRoot({name: 'Alice', phone: '010-1234-5678'});
    const {logger} = createLogger();
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = [];
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload});
      return completedResult();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(root),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
      ),
    );

    const ageInput = findTextInput(renderer, sampleMemberDeskTestId('sample.desk.customer-member:age'));
    await act(async () => {
      ageInput.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    expect(getRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard')})).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm')}),
    ).toBeDefined();
    expect(ageInput.props.maxLength).toBe(3);

    await act(async () => {
      ageInput.props.onChangeText('37');
    });
    expect(
      (root['kernel.feature.sample-member-registry.members'] as {readonly hostPending: unknown}).hostPending,
    ).toEqual({
      operationId: 'operation:010-1234-5678',
      name: 'Alice',
      phone: '010-1234-5678',
    });
    await act(async () => {
      await press(renderer, sampleMemberDeskTestId('sample.desk.customer-member:confirm'))();
    });
    expect(dispatched).toContainEqual({
      name: confirmMemberCommand.commandName,
      payload: {operationId: 'operation:010-1234-5678', age: 37},
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('confirms a blank customer age without inventing a value', async () => {
    const {logger} = createLogger();
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = [];
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload});
      return completedResult();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'handheld-confirm'})),
      ),
    );

    await act(async () => {
      await press(renderer, sampleMemberDeskTestId('sample.desk.customer-member:confirm'))();
    });
    expect(dispatched).toContainEqual({
      name: confirmMemberCommand.commandName,
      payload: {operationId: 'operation:010-1234-5678'},
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('routes dual-machine LMS confirmation to the peer host owner with the projected operation id', async () => {
    const {logger} = createLogger();
    const dispatched: Array<Readonly<{name: string; payload: unknown; target: string | undefined}>> = [];
    const dispatchCommand = ((command, options) => {
      dispatched.push({
        name: command.definition.commandName,
        payload: command.payload,
        target: options.target,
      });
      return Promise.resolve(completedResult());
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Host member', phone: '010-3333-4444'}, [], 'SLAVE')),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
      ),
    );

    await act(async () => {
      await press(renderer, sampleMemberDeskTestId('sample.desk.customer-member:confirm'))();
    });
    expect(dispatched).toContainEqual({
      name: confirmMemberCommand.commandName,
      payload: {operationId: 'operation:010-3333-4444'},
      target: 'peer',
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps the age field and customer decisions in the same input surface', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
      ),
    );
    const ageInput = findTextInput(renderer, sampleMemberDeskTestId('sample.desk.customer-member:age'));
    await act(async () => {
      ageInput.props.onFocus({nativeEvent: {}});
    });
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:scroll')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:reject')}),
    ).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps customer decisions available when the frame cannot render a keyboard', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'handheld-confirm'})),
      ),
      {width: 320, height: 541},
    );
    const ageInput = findTextInput(renderer, sampleMemberDeskTestId('sample.desk.customer-member:age'));
    await act(async () => {
      ageInput.props.onFocus({nativeEvent: {}});
    });
    expect(queryRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard')})).toHaveLength(0);
    expect(getRenderedByProps(renderer, {testID: inputTestIds.node('unsupported-size')})).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:reject')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.customer-member:hand-back')}),
    ).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('renders waiting name, phone, and withdraw action from the owner selector', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(WaitingConfirm),
      ),
    );

    expectTextValue(renderer, sampleMemberDeskTestId('sample.desk.waiting-confirm:member-name'), 'Alice');
    expectTextValue(renderer, sampleMemberDeskTestId('sample.desk.waiting-confirm:member-phone'), '010-1234-5678');
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.waiting-confirm:withdraw')}),
    ).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps registry notice decisive with retry and abandon but no dismiss action', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(RegistryNotice, {reasonCode: 'customer-rejected'}),
      ),
    );

    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.registry-notice:retry')}),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.registry-notice:abandon')}),
    ).toBeDefined();
    expect(
      queryRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.registry-notice:dismiss')}),
    ).toHaveLength(0);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it.each([
    ['error', resultWithActors('error', [actorFailure('SYSTEM')])],
    ['timed-out', resultWithActors('timed-out', [{...actorFailure('SYSTEM'), status: 'timed-out', error: null}])],
    [
      'partial-failed',
      resultWithActors('partial-failed', [
        {...actorFailure('SYSTEM'), status: 'completed', error: null},
        actorFailure('SYSTEM'),
      ]),
    ],
  ] as const)('observes resolved %s as a system failure without exposing raw error', async (_label, firstResult) => {
    const {logger} = createLogger();
    const commandNames: string[] = [];
    const dispatchCommand = (async command => {
      commandNames.push(command.definition.commandName);
      return commandNames.length === 1 ? firstResult : completedResult();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
      ),
    );

    const confirm = getRenderedByProps(renderer, {
      testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm'),
    });
    await act(async () => {
      await (confirm.props.onPress as () => Promise<unknown>)();
    });
    expect(commandNames).toEqual([confirmMemberCommand.commandName, deskSystemFailureObservedCommand.commandName]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps running non-terminal and business failures out of system notice', async () => {
    for (const firstResult of [
      resultWithActors('running', [runningActor()]),
      resultWithActors('error', [actorFailure('BUSINESS')]),
    ]) {
      const {logger} = createLogger();
      const commandNames: string[] = [];
      const dispatchCommand = (async command => {
        commandNames.push(command.definition.commandName);
        return firstResult;
      }) as RenderProviderProps['dispatchCommand'];
      const renderer = await mount(
        createElement(
          RenderProvider,
          {
            stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
            uiCatalog: createUiCatalog([]),
            rendererCatalog: createRendererCatalog([]),
            logger,
            dispatchCommand,
            selectUiVariable: (_root, declaration) => declaration.defaultValue,
          },
          withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
        ),
      );

      const confirm = getRenderedByProps(renderer, {
        testID: sampleMemberDeskTestId('sample.desk.customer-member:confirm'),
      });
      await act(async () => {
        await (confirm.props.onPress as () => Promise<unknown>)();
      });
      expect(commandNames).toEqual([confirmMemberCommand.commandName]);
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('renders both system-notice profiles with fixed copy and shared semantics', async () => {
    for (const [Component, isMobile] of [
      [DeskSystemNotice, false],
      [MobileDeskSystemNotice, true],
    ] as const) {
      const {logger} = createLogger();
      const renderer = await mount(
        createElement(
          RenderProvider,
          {
            stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
            uiCatalog: createUiCatalog([]),
            rendererCatalog: createRendererCatalog([]),
            logger,
            dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
            selectUiVariable: (_root, declaration) => declaration.defaultValue,
          },
          createElement(Component, {operation: 'confirm-member'}),
        ),
      );

      expectTextValue(
        renderer,
        deriveSampleMemberDeskTestId('sample.desk.system-notice', 'message'),
        '操作没有完成，请重试',
      );
      expectTextAbsent(renderer, 'ledger write failed');
      expect(
        queryRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.system-notice')}).map(
          node => node.props.style,
        ),
      ).toContainEqual(
        isMobile ? {flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'} : {flex: 1, minHeight: 0, padding: 24},
      );
      const cardStyles = queryRenderedByProps(renderer, {
        testID: deriveSampleMemberDeskTestId('sample.desk.system-notice', 'card'),
      }).map(node => StyleSheet.flatten(node.props.style as never));
      expect(cardStyles).toHaveLength(1);
      expect(cardStyles[0]).toEqual(
        expect.objectContaining(isMobile ? {width: '100%'} : {width: '100%', maxWidth: 720}),
      );
      expect(
        queryRenderedByProps(renderer, {
          testID: deriveSampleMemberDeskTestId('sample.desk.system-notice', 'actions'),
        }).map(node => node.props.className),
      ).toContain(isMobile ? 'w-full items-center gap-3' : 'flex-row flex-wrap items-start gap-3');
      const dismissStyles = queryRenderedByProps(renderer, {
        testID: deriveSampleMemberDeskTestId('sample.desk.system-notice', 'dismiss'),
      }).map(node => StyleSheet.flatten(node.props.style as never));
      expect(dismissStyles).toHaveLength(1);
      if (isMobile) expect(dismissStyles[0]).toEqual(expect.objectContaining({width: '100%'}));
      else expect(dismissStyles[0]).toBeUndefined();
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it('dispatches the member-desk-owned command when dismissing a system failure', async () => {
    const {logger} = createLogger();
    const commandNames: string[] = [];
    const dispatchCommand = (async command => {
      commandNames.push(command.definition.commandName);
      return completedResult();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: '', phone: ''})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(DeskSystemNotice, {operation: 'submit-member'}),
      ),
    );

    await act(async () => {
      await press(renderer, deriveSampleMemberDeskTestId('sample.desk.system-notice', 'dismiss'))();
    });
    expect(commandNames).toEqual([deskSystemFailureDismissedCommand.commandName]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps the complete member list while mounting at most 24 rows and scrolling to the last member', async () => {
    const {logger} = createLogger();
    const members = Array.from({length: 30}, (_value, index) => ({
      memberId: `member-${index}`,
      operationId: `operation-${index}`,
      name: `Member ${index}`,
      phone: `010-${String(index).padStart(4, '0')}-0000`,
      registeredAt: index,
    }));
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Pending', phone: '010-0000-0000'}, members)),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => ({
            requestId: null,
            commandId: 'command_test' as never,
            status: 'completed' as const,
            actorResults: [],
          })) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(MemberList),
      ),
    );

    const virtualizedList = () =>
      queryRenderedByType(renderer, 'VirtualizedList').find(
        node => node.props.testID === sampleMemberDeskTestId('sample.desk.member-list:scroll'),
      );
    type ListProps = Readonly<{
      readonly data: readonly (typeof members)[number][];
      readonly getItemCount: (items: readonly (typeof members)[number][]) => number;
      readonly renderItem: (input: Readonly<{item: (typeof members)[number]; index: number}>) => ReactElement<{
        readonly testID?: string;
        readonly children?: ReactNode;
      }>;
      readonly onScroll: (event: Readonly<{nativeEvent: Readonly<{contentOffset: Readonly<{y: number}>}>}>) => void;
    }>;
    const list = virtualizedList();
    expect(list).toBeDefined();
    const initialProps = list!.props as ListProps;
    expect(initialProps.getItemCount(initialProps.data)).toBe(30);
    const renderedWindowSize = (props: ListProps) =>
      props.data.filter((item, index) => typeof props.renderItem({item, index}).props.testID === 'string').length;
    expect(renderedWindowSize(initialProps)).toBeLessThanOrEqual(24);
    await act(async () => {
      initialProps.onScroll({nativeEvent: {contentOffset: {y: 29 * 64}}});
    });
    const finalList = virtualizedList();
    expect(finalList).toBeDefined();
    const finalProps = finalList!.props as ListProps;
    expect(renderedWindowSize(finalProps)).toBeLessThanOrEqual(24);
    const finalRow = finalProps.renderItem({item: members[29]!, index: 29});
    expect(finalRow.props.testID).toBe(
      deriveSampleMemberDeskTestId('sample.desk.member-list:scroll', 'row', 'member-29'),
    );
    const finalMember = finalRow.props.children as ReactElement<{
      readonly testID: string;
      readonly name: string;
      readonly phone: string;
    }>;
    expect(finalMember.props.testID).toBe(sampleMemberDeskTestId('sample.desk.member-list:row:member-29'));
    expect(finalMember.props.name).toBe('Member 29');
    expect(finalMember.props.phone).toBe('010-0029-0000');
    expect(
      queryRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.member-list:add')}),
    ).toHaveLength(1);
    expect(
      queryRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.member-list:logout')}),
    ).toHaveLength(1);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps member-form actions outside its single scroll ancestor', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: '', phone: ''})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(MemberForm)),
      ),
    );

    const scrollArea = getRenderedByProps(renderer, {
      testID: sampleMemberDeskTestId('sample.desk.member-form:scroll'),
    }) as unknown as TestInstanceQuery;
    expect(
      getRenderedByProps(renderer, {testID: sampleMemberDeskTestId('sample.desk.member-form:title')}),
    ).toBeDefined();
    expect(
      queryRenderedSubtree(
        scrollArea,
        node => node.props.testID === sampleMemberDeskTestId('sample.desk.member-form:title'),
      ),
    ).toHaveLength(0);
    expect(
      getRenderedDescendantByProps(scrollArea, {testID: sampleMemberDeskTestId('sample.desk.member-form:name')}),
    ).toBeDefined();
    expect(
      getRenderedDescendantByProps(scrollArea, {testID: sampleMemberDeskTestId('sample.desk.member-form:phone')}),
    ).toBeDefined();
    expect(
      getRenderedDescendantByProps(scrollArea, {
        testID: sampleMemberDeskTestId('sample.desk.member-form:keyboard-alpha-probe'),
      }),
    ).toBeDefined();
    expect(
      getRenderedDescendantByProps(scrollArea, {
        testID: sampleMemberDeskTestId('sample.desk.member-form:keyboard-financial-probe'),
      }),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {
        testID: sampleMemberDeskTestId('sample.desk.member-form:keyboard-alpha-probe-notice'),
      }),
    ).toBeDefined();
    expect(
      getRenderedByProps(renderer, {
        testID: sampleMemberDeskTestId('sample.desk.member-form:keyboard-financial-probe-notice'),
      }),
    ).toBeDefined();
    expect(
      queryRenderedSubtree(
        scrollArea,
        node => node.props.testID === sampleMemberDeskTestId('sample.desk.member-form:submit'),
      ),
    ).toHaveLength(0);
    expect(
      queryRenderedSubtree(
        scrollArea,
        node => node.props.testID === sampleMemberDeskTestId('sample.desk.member-form:cancel'),
      ),
    ).toHaveLength(0);
    const actions = getRenderedByProps(renderer, {
      testID: sampleMemberDeskTestId('sample.desk.member-form:actions'),
    }) as unknown as TestInstanceQuery;
    expect(
      getRenderedDescendantByProps(actions, {testID: sampleMemberDeskTestId('sample.desk.member-form:submit')}),
    ).toBeDefined();
    expect(
      getRenderedDescendantByProps(actions, {testID: sampleMemberDeskTestId('sample.desk.member-form:cancel')}),
    ).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('measures every member-form virtual field relative to its actual scroll content node', async () => {
    const {logger} = createLogger();
    const memberFieldIds = [
      'sample.desk.member-form:name',
      'sample.desk.member-form:phone',
      'sample.desk.member-form:keyboard-alpha-probe',
      'sample.desk.member-form:keyboard-financial-probe',
    ] as const;
    const measuredFields: Array<Readonly<{readonly fieldId: string; readonly relativeTo: unknown}>> = [];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: '', phone: ''})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(MemberForm)),
      ),
      {width: 1280, height: 800},
      createScrollFieldNodeMock(
        {},
        [{scrollTestID: sampleMemberDeskTestId('sample.desk.member-form:scroll'), fieldIds: memberFieldIds}],
        measuredFields,
      ),
    );

    await initializeScrollArea(renderer, sampleMemberDeskTestId('sample.desk.member-form:scroll'));
    for (const fieldId of memberFieldIds) {
      await act(async () => {
        findTextInput(renderer, fieldId).props.onFocus({nativeEvent: {}});
      });
      await finishKeyboardPresentation(renderer);
    }
    expect([...new Set(measuredFields.map(field => field.fieldId))]).toEqual(
      memberFieldIds.map(sampleMemberDeskTestId),
    );
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('measures the customer age field relative to its actual scroll content node', async () => {
    const {logger} = createLogger();
    const fieldId = 'sample.desk.customer-member:age';
    const measuredFields: Array<Readonly<{readonly fieldId: string; readonly relativeTo: unknown}>> = [];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Alice', phone: '010-1234-5678'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(CustomerMember, {mode: 'confirm'})),
      ),
      {width: 1280, height: 800},
      createScrollFieldNodeMock(
        {},
        [{scrollTestID: sampleMemberDeskTestId('sample.desk.customer-member:scroll'), fieldIds: [fieldId]}],
        measuredFields,
      ),
    );

    await initializeScrollArea(renderer, sampleMemberDeskTestId('sample.desk.customer-member:scroll'));
    await act(async () => {
      findTextInput(renderer, fieldId).props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    expect([...new Set(measuredFields.map(field => field.fieldId))]).toEqual([sampleMemberDeskTestId(fieldId)]);
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('exercises alpha and financial layouts without adding them to the member payload', async () => {
    const {logger} = createLogger();
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = [];
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload});
      return completedResult();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: '', phone: ''})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(MemberForm)),
      ),
    );

    const financialInput = findTextInput(
      renderer,
      sampleMemberDeskTestId('sample.desk.member-form:keyboard-financial-probe'),
    );
    const phoneInput = findTextInput(renderer, sampleMemberDeskTestId('sample.desk.member-form:phone'));
    await act(async () => {
      phoneInput.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    expect(getRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard:text-1')})).toBeDefined();
    await act(async () => {
      press(renderer, inputTestIds.node('virtual-keyboard:text-1'))();
    });
    await act(async () => {
      press(renderer, inputTestIds.node('virtual-keyboard:complete'))();
    });
    await finishKeyboardPresentation(renderer);
    await act(async () => {
      findTextInput(renderer, sampleMemberDeskTestId('sample.desk.member-form:keyboard-alpha-probe')).props.onFocus({
        nativeEvent: {},
      });
    });
    await finishKeyboardPresentation(renderer);
    expect(getRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard:text-a')})).toBeDefined();
    expect(queryRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard:text--')})).toHaveLength(0);
    await act(async () => {
      press(renderer, inputTestIds.node('virtual-keyboard:text-a'))();
    });
    await act(async () => {
      press(renderer, inputTestIds.node('virtual-keyboard:complete'))();
    });
    await finishKeyboardPresentation(renderer);
    await act(async () => {
      financialInput.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    expect(getRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard:text--')})).toBeDefined();
    expect(getRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard:text-.')})).toBeDefined();
    expect(financialInput.props.value).toBe('');
    await act(async () => {
      press(renderer, inputTestIds.node('virtual-keyboard:text-1'))();
      press(renderer, inputTestIds.node('virtual-keyboard:text-.'))();
      press(renderer, inputTestIds.node('virtual-keyboard:text-2'))();
    });
    expect(financialInput.props.value).toBe('1.2');
    await act(async () => {
      phoneInput.props.onFocus({nativeEvent: {}});
    });
    await finishKeyboardPresentation(renderer);
    expect(getRenderedByProps(renderer, {testID: inputTestIds.node('virtual-keyboard:text-1')})).toBeDefined();
    await act(async () => {
      await press(renderer, sampleMemberDeskTestId('sample.desk.member-form:submit'))();
    });
    expect(dispatched).toContainEqual({
      name: submitMemberCommand.commandName,
      payload: {name: '', phone: '1'},
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it.each([
    ['landscape PRIMARY', {width: 1280, height: 800}],
    ['portrait PRIMARY', {width: 360, height: 720}],
  ] as const)(
    'covers the member-form numeric, alpha, and financial consumers in the %s frame',
    async (_label, frameLayout) => {
      const {logger} = createLogger();
      const renderer = await mount(
        createElement(
          RenderProvider,
          {
            stateSource: createStateSource(memberRoot({name: '', phone: ''})),
            uiCatalog: createUiCatalog([]),
            rendererCatalog: createRendererCatalog([]),
            logger,
            dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
            selectUiVariable: (_root, declaration) => declaration.defaultValue,
          },
          withInputSurface(createElement(MemberForm)),
        ),
        frameLayout,
      );

      const fields = [
        ['sample.desk.member-form:phone', inputTestIds.node('virtual-keyboard:text-1')],
        ['sample.desk.member-form:keyboard-alpha-probe', inputTestIds.node('virtual-keyboard:text-a')],
        ['sample.desk.member-form:keyboard-financial-probe', inputTestIds.node('virtual-keyboard:text-.')],
      ] as const;
      for (const [fieldID, keyID] of fields) {
        const field = findTextInput(renderer, fieldID);
        await act(async () => {
          field.props.onFocus({nativeEvent: {}});
        });
        await finishKeyboardPresentation(renderer);
        expect(getRenderedByProps(renderer, {testID: keyID})).toBeDefined();
      }
      await act(async () => {
        await renderer.unmount();
      });
    },
  );

  it('submits name and phone from one synchronous input snapshot', async () => {
    const {logger} = createLogger();
    const dispatched: Array<Readonly<{name: string; payload: unknown}>> = [];
    const dispatchCommand = (async command => {
      dispatched.push({name: command.definition.commandName, payload: command.payload});
      return completedResult();
    }) as RenderProviderProps['dispatchCommand'];
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: '', phone: ''})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        withInputSurface(createElement(MemberForm)),
      ),
    );

    const nameInput = findTextInput(renderer, sampleMemberDeskTestId('sample.desk.member-form:name'));
    const phoneInput = findTextInput(renderer, sampleMemberDeskTestId('sample.desk.member-form:phone'));
    await act(async () => {
      nameInput.props.onChangeText('Alice');
      phoneInput.props.onChangeText('010-1234-5678');
    });
    await act(async () => {
      await press(renderer, sampleMemberDeskTestId('sample.desk.member-form:submit'))();
    });
    expect(dispatched).toContainEqual({
      name: submitMemberCommand.commandName,
      payload: {name: 'Alice', phone: '010-1234-5678'},
    });
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('keeps the empty-state action in the fixed action region', async () => {
    const {logger} = createLogger();
    const renderer = await mount(
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: '', phone: ''})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand: (async () => completedResult()) as RenderProviderProps['dispatchCommand'],
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(MemberList),
      ),
    );

    const scrollArea = getRenderedByProps(renderer, {
      testID: sampleMemberDeskTestId('sample.desk.member-list:scroll'),
    }) as unknown as TestInstanceQuery;
    const actions = getRenderedByProps(renderer, {
      testID: sampleMemberDeskTestId('sample.desk.member-list:actions'),
    }) as unknown as TestInstanceQuery;
    expect(
      getRenderedDescendantByProps(scrollArea, {testID: sampleMemberDeskTestId('sample.desk.member-list:empty')}),
    ).toBeDefined();
    expect(
      queryRenderedSubtree(
        scrollArea,
        node => node.props.testID === sampleMemberDeskTestId('sample.desk.member-list:empty-action'),
      ),
    ).toHaveLength(0);
    expect(
      getRenderedDescendantByProps(actions, {testID: sampleMemberDeskTestId('sample.desk.member-list:empty-action')}),
    ).toBeDefined();
    expect(
      getRenderedDescendantByProps(actions, {testID: sampleMemberDeskTestId('sample.desk.member-list:logout')}),
    ).toBeDefined();
    await act(async () => {
      await renderer.unmount();
    });
  });

  it('diagnoses infrastructure rejection from a customer decision without treating it as success', async () => {
    const {logger, events} = createLogger();
    const failure = new Error('ledger write failed');
    const dispatchCommand = (async () => {
      throw failure;
    }) as RenderProviderProps['dispatchCommand'];
    const HookProvider = ({children}: Readonly<{children?: ReactNode}>) =>
      createElement(
        RenderProvider,
        {
          stateSource: createStateSource(memberRoot({name: 'Pending', phone: '010-0000-0000'})),
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
        },
        createElement(InputSurfaceFrame, {}, children),
      );
    const hook = await renderHook(() => useCustomerMember({mode: 'confirm'}), {wrapper: HookProvider});
    await act(async () => {
      await expect(hook.result.current.confirm()).rejects.toBe(failure);
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        category: 'ui.base.render',
        event: 'command-dispatch-rejected',
        data: {failure: 'promise-rejected'},
      }),
    );
    await hook.unmount();
  });

  it('treats a repeated system failure observation as an idempotent existing notice', async () => {
    const catalog = createUiCatalog(
      sampleMemberDeskAssembly.parts
        .filter(part => part.catalogEntry.surfaceForm.includes('mobile'))
        .map(part => part.catalogEntry),
    );
    const loggerEvents: LogEvent[] = [];
    const runtime = createTestRuntime(
      [
        createDisplayContextModule(),
        createTransportModule(),
        createTopologyModule({
          displayName: 'sample member desk test',
          moduleName: 'ui.integration.sample-console',
          surfaceForm: 'mobile',
        }),
        createUiStateModule({catalog, variables: [], surfaceForm: 'mobile'}),
        createSampleStaffSessionModule(),
        createSampleMemberRegistryModule(),
        createSampleMemberDeskModule(),
      ],
      undefined,
      loggerEvents,
    );
    try {
      await runtime.start();
      const first = await runtime.dispatchCommand(
        deskSystemFailureObservedCommand,
        {operation: 'submit-member'},
        {requestId: createRequestId()},
      );
      const second = await runtime.dispatchCommand(
        deskSystemFailureObservedCommand,
        {operation: 'submit-member'},
        {requestId: createRequestId()},
      );
      expect(first.status).toBe('completed');
      expect(second.status).toBe('completed');
      expect(selectLayers(runtime.getState(), 'PRIMARY')).toEqual([
        expect.objectContaining({
          layerId: 'sample.desk.system-notice',
          partKey: 'sample.desk.system-notice',
          persistence: 'ephemeral',
        }),
      ]);
      expect(loggerEvents.some(event => event.event === 'ui-state.layer.duplicate-rejected')).toBe(false);
      expect(
        runtime.journal
          .list()
          .some(
            event =>
              event.kind === 'command.completed' &&
              event.status === 'error' &&
              event.commandName === 'kernel.base.ui-state.open-layer',
          ),
      ).toBe(false);
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });
});
