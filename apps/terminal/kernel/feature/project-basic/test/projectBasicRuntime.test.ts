import {unavailableRemoteControlPort} from '@catering-v2s/kernel-base-platform-ports';
import * as ts from 'typescript';
import {describe, expect, it} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  createRuntimeModule,
  createRuntime,
  defineActor,
  onCommand,
  type CreateRuntimeInput,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {defineStateRuntimeSlice, type StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  acceptTerminalTopicNotificationCommand,
  executeTerminalHttpCommand,
  moduleName as terminalDataClientModuleName,
  subscribeTerminalTopicCommand,
  terminalActivationSucceededCommand,
  terminalTopicChangedCommand,
  unsubscribeTerminalTopicCommand,
  type TerminalClientState,
  type TerminalHttpCommandPayload,
  type TerminalTopicSubscription,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {
  moduleName as terminalUpdateModuleName,
  requestTerminalUpdateCommand,
} from '@catering-v2s/kernel-base-terminal-update';
import {
  createStoreBasicModule,
  initializeStoreBasicCommand,
  selectActiveContracts,
  selectServicePointAreas,
  selectServicePoints,
  selectStore,
  selectStoreBasicLoadReadiness,
  storeBasicSliceName,
} from '@catering-v2s/kernel-feature-store-basic';
import {createProjectBasicModule, projectBasicSliceName} from '../src/index';
import invariant from '../terminal-invariants.json';

const readPublicExports = (): readonly string[] => {
  const indexPath = decodeURIComponent(new URL('../src/index.ts', import.meta.url).pathname);
  const program = ts.createProgram({
    rootNames: [indexPath],
    options: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      resolveJsonModule: true,
    },
  });
  const sourceFile = program.getSourceFile(indexPath);
  if (sourceFile === undefined) throw new Error(`missing source file: ${indexPath}`);
  const moduleSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) throw new Error(`missing module symbol: ${indexPath}`);
  return program
    .getTypeChecker()
    .getExportsOfModule(moduleSymbol)
    .map(symbol => symbol.name)
    .sort();
};
type OwnerReadOperationId =
  | 'terminalReadContract'
  | 'terminalReadServicePoint'
  | 'terminalReadServicePointArea'
  | 'terminalReadStoreActiveContracts'
  | 'terminalReadStoreBasic'
  | 'terminalReadStoreOrganizationPath'
  | 'terminalReadStoreServicePointAreas'
  | 'terminalReadStoreServicePoints'
  | 'terminalReadProjectUpdateRuleSnapshotPage';

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(complete => {
    resolve = complete;
  });
  return {promise, resolve};
};

const terminalClientSliceName = `${terminalDataClientModuleName}.client`;
const terminalCredential = Object.freeze({
  terminalRef: '10000000-0000-4000-8000-000000000001',
  storeRef: '10000000-0000-4000-8000-000000000002',
  groupWorkspaceKey: 'workspace-1',
  bindingGeneration: 7,
  deviceId: 'device-1',
  credentialSecret: 'A'.repeat(43),
});
const projectRef = '10000000-0000-4000-8000-000000000003';
const regionRef = '10000000-0000-4000-8000-000000000004';
const commercialGroupRef = '10000000-0000-4000-8000-000000000005';
const contractRef = '10000000-0000-4000-8000-000000000006';
const servicePointAreaRef = '10000000-0000-4000-8000-000000000007';
const servicePointRef = '10000000-0000-4000-8000-000000000008';
const terminalContract = Object.freeze({
  id: contractRef,
  groupWorkspaceKey: terminalCredential.groupWorkspaceKey,
  project: {id: projectRef, code: 'PROJECT-1', name: 'Sample Project'},
  store: {id: terminalCredential.storeRef, code: 'STORE-1', name: 'Sample Store'},
  tenant: {id: 'tenant-1', code: 'TENANT-1', name: 'Sample Tenant'},
  phaseName: null,
  contractNo: 'CONTRACT-1',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  extensionValues: {},
  extensionRuleRevision: 0,
  status: 'VALID',
  revision: 1,
  source: 'MANUAL',
  createdAt: 1,
  updatedAt: 15,
  items: [{code: 'ITEM-1', name: 'Sample Item'}],
});

const initialTerminalClientState = Object.freeze({
  credential: terminalCredential,
  credentialRevision: 1,
  credentialReadyRevision: 1,
  credentialReadyInstanceMode: 'MASTER',
  pendingActivations: Object.freeze({}),
  activationStatus: 'active',
  connection: Object.freeze({
    status: 'stopped',
    addressName: null,
    nodeId: null,
    sessionId: null,
    lastCloseReason: null,
  }),
  heartbeatIntervalMs: null,
  nextPingSequence: 1,
  lastRttMs: 0,
  latencySamples: Object.freeze([]),
  topicSubscriptions: Object.freeze({}),
  acceptedTopicTimes: Object.freeze({}),
  remoteOperations: Object.freeze({}),
}) as TerminalClientState;

const terminalClientStateSlice = defineStateRuntimeSlice<TerminalClientState>({
  name: terminalClientSliceName,
  reducer: (state = initialTerminalClientState, action) => {
    if (action.type === 'test/terminal-topic-subscribed') {
      const subscription = (action as unknown as {payload: TerminalTopicSubscription}).payload;
      return Object.freeze({
        ...state,
        topicSubscriptions: Object.freeze({
          ...state.topicSubscriptions,
          [subscription.subscriptionId]: subscription,
        }),
      });
    }
    if (action.type === 'test/terminal-topic-unsubscribed') {
      const request = (action as unknown as {payload: {subscriberKey: string; topicKey: string; ownerRef: string}})
        .payload;
      const topicSubscriptions = Object.fromEntries(
        Object.entries(state.topicSubscriptions).filter(
          ([, subscription]) =>
            subscription.subscriberKey !== request.subscriberKey ||
            subscription.topicKey !== request.topicKey ||
            subscription.ownerRef !== request.ownerRef,
        ),
      );
      return Object.freeze({...state, topicSubscriptions: Object.freeze(topicSubscriptions)});
    }
    return state;
  },
  persistIntent: 'never',
});

const serverConfigTestSlice = defineStateRuntimeSlice<{
  readonly selectedSpace: string;
  readonly serviceRevisions: Readonly<Record<string, number>>;
}>({
  name: serverConfigSliceName,
  reducer: (state = Object.freeze({selectedSpace: 'development', serviceRevisions: Object.freeze({business: 0})})) => state,
  persistIntent: 'never',
});

const completion = <TValue>(value: TValue) => ({status: 'succeeded', value, completedAt: 1 as never});

const createRuntimePorts = (
  persisted: Map<string, string>,
  onPlainStorageWrite: () => void,
  diagnosticLogs: unknown[],
): CreateRuntimeInput['platformPorts'] => {
  const createStorage = (values: Map<string, string>) => ({
    read: async ({key}: {key: string}) =>
      completion(values.has(key) ? {state: 'found', value: values.get(key) ?? ''} : {state: 'missing'}),
    write: async ({key, value}: {key: string; value: string}) => {
      values.set(key, value);
      if (values === persisted) onPlainStorageWrite();
      return completion({completed: true});
    },
    remove: async ({key}: {key: string}) => {
      values.delete(key);
      return completion({completed: true});
    },
    readMany: async ({keys}: {keys: readonly string[]}) =>
      completion(
        keys.map(key => ({
          key,
          result: values.has(key)
            ? {state: 'found' as const, value: values.get(key) ?? ''}
            : {state: 'missing' as const},
        })),
      ),
    writeMany: async ({entries}: {entries: readonly {key: string; value: string}[]}) => {
      for (const entry of entries) values.set(entry.key, entry.value);
      if (values === persisted) onPlainStorageWrite();
      return completion({completed: true});
    },
    removeMany: async ({keys}: {keys: readonly string[]}) => {
      for (const key of keys) values.delete(key);
      return completion({completed: true});
    },
    listKeys: async () => completion([...values.keys()]),
    clear: async () => {
      values.clear();
      return completion({completed: true});
    },
  });
  const storage = createStorage(persisted);
  const protectedStorage = createStorage(new Map());
  let logger: ReturnType<CreateRuntimeInput['platformPorts']['logger']['scope']>;
  const logResult = completion({} as never);
  const captureLog = (entry: unknown) => {
    diagnosticLogs.push(entry);
    return logResult;
  };
  logger = {
    debug: captureLog,
    info: captureLog,
    warn: captureLog,
    error: captureLog,
    scope: () => logger,
    withContext: () => logger,
  } as ReturnType<CreateRuntimeInput['platformPorts']['logger']['scope']>;
  return {
    logger,
    persistKv: storage,
    persistSecure: protectedStorage,
    device: {} as never,
    appControl: {} as never,
    script: {} as never,
    connector: {} as never,
    update: {} as never,
    logUpload: {} as never,
    topologyHost: {} as never,
    remoteControl: unavailableRemoteControlPort,
  } as CreateRuntimeInput['platformPorts'];
};

const withoutAutomaticLifecycle = (module: RuntimeModule): RuntimeModule => {
  const {install: _install, onApplicationReset: _onApplicationReset, preSetup: _preSetup, ...declared} = module;
  return Object.freeze({...declared, dependencies: Object.freeze([])});
};

describe('CP-01 project/store owner handoff through Runtime dispatch', () => {
  it('matches the package root barrel to its declared public exports exactly', () => {
    expect(readPublicExports()).toEqual([...invariant.publicExports].sort());
  });

  it('starts and persists store follow-up reads while the independent organization read is still pending', async () => {
    const organizationReadStarted = deferred<void>();
    const releaseOrganizationRead = deferred<void>();
    const storeFollowupsStarted = deferred<void>();
    const readOperations = new Set<OwnerReadOperationId>();
    const persisted = new Map<string, string>();
    const diagnosticLogs: unknown[] = [];
    const storeFollowupsSaved = deferred<void>();
    let inspectPersistedStore: () => void = () => {};
    let subscriptionSequence = 0;
    const operatingRules = {
      catalogManagementEnabled: true,
      externalCatalogSyncEnabled: false,
      openPlatformDeveloperCode: '',
      reservationEnabled: false,
      reservationDepositEnabled: false,
      queueCallEnabled: false,
      tableManagementEnabled: false,
      tableStatusEnabled: false,
      tableWaitCallEnabled: false,
      banquetOrderEnabled: false,
      pickupCallEnabled: false,
      receivableEnabled: false,
    };

    const readBody = (operationId: OwnerReadOperationId): StateJsonValue => {
      switch (operationId) {
        case 'terminalReadStoreBasic':
          return {
            store: {
              id: terminalCredential.storeRef,
              groupWorkspaceKey: terminalCredential.groupWorkspaceKey,
              code: 'STORE-1',
              name: 'Sample Store',
              project: {id: projectRef, code: 'PROJECT-1', name: 'Sample Project'},
              brand: {id: 'brand-1', code: 'BRAND-1', name: 'Sample Brand'},
              tenant: {id: 'tenant-1', code: 'TENANT-1', name: 'Sample Tenant'},
              status: 'ENABLED',
              extensionValues: {},
              extensionRuleRevision: 0,
              revision: 1,
              createdAt: 1,
              updatedAt: 2,
              contractDerivedStatus: 'OPERATING',
              operatingRuleSwitches: operatingRules,
            },
            operatingRules,
            storeUpdatedAtEpochMillis: 10,
            operatingRulesUpdatedAtEpochMillis: 11,
          };
        case 'terminalReadStoreActiveContracts':
          return {items: [terminalContract], collectionUpdatedAtEpochMillis: 15};
        case 'terminalReadContract':
          return {contract: terminalContract, updatedAtEpochMillis: 15};
        case 'terminalReadStoreServicePointAreas':
          return {
            items: [
              {
                areaRef: servicePointAreaRef,
                storeRef: terminalCredential.storeRef,
                name: 'Sample Area',
                code: 'AREA-1',
                areaType: 'TABLE_AREA',
                status: 'ENABLED',
                displayOrder: 1,
                version: 1,
                createdAt: 1,
                updatedAt: 16,
              },
            ],
            collectionUpdatedAtEpochMillis: 16,
          };
        case 'terminalReadServicePointArea':
          return {
            area: {
              areaRef: servicePointAreaRef,
              storeRef: terminalCredential.storeRef,
              name: 'Sample Area',
              code: 'AREA-1',
              areaType: 'TABLE_AREA',
              status: 'ENABLED',
              displayOrder: 1,
              version: 1,
              createdAt: 1,
              updatedAt: 16,
            },
            updatedAtEpochMillis: 16,
          };
        case 'terminalReadStoreServicePoints':
          return {
            items: [
              {
                pointRef: servicePointRef,
                storeRef: terminalCredential.storeRef,
                areaRef: servicePointAreaRef,
                name: 'Sample Point',
                code: 'POINT-1',
                pointType: 'TABLE',
                status: 'ENABLED',
                displayOrder: 1,
                extensionValues: {},
                version: 1,
                createdAt: 1,
                updatedAt: 17,
              },
            ],
            collectionUpdatedAtEpochMillis: 17,
          };
        case 'terminalReadServicePoint':
          return {
            servicePoint: {
              pointRef: servicePointRef,
              storeRef: terminalCredential.storeRef,
              areaRef: servicePointAreaRef,
              name: 'Sample Point',
              code: 'POINT-1',
              pointType: 'TABLE',
              status: 'ENABLED',
              displayOrder: 1,
              extensionValues: {},
              version: 1,
              createdAt: 1,
              updatedAt: 17,
            },
            updatedAtEpochMillis: 17,
          };
        case 'terminalReadStoreOrganizationPath':
          return {
            projectRef,
            projectName: 'Sample Project',
            regionRef,
            regionName: 'Sample Region',
            commercialGroupRef,
            commercialGroupName: 'Sample Group',
            projectUpdatedAtEpochMillis: 20,
            regionUpdatedAtEpochMillis: 21,
            commercialGroupUpdatedAtEpochMillis: 22,
          };
        case 'terminalReadProjectUpdateRuleSnapshotPage':
          return {items: [], collectionHash: 'a'.repeat(64), nextCursor: null};
        default:
          throw new Error(`Unexpected terminal read in CP-01 Runtime proof: ${operationId}`);
      }
    };

    const operationForPath = (pathAndQuery: string): OwnerReadOperationId => {
      const path = pathAndQuery.split('?', 1)[0] ?? pathAndQuery;
      if (path === `/stores/${terminalCredential.storeRef}/basic`) return 'terminalReadStoreBasic';
      if (path === `/stores/${terminalCredential.storeRef}/contracts`) return 'terminalReadStoreActiveContracts';
      if (path === `/contracts/${contractRef}`) return 'terminalReadContract';
      if (path === `/stores/${terminalCredential.storeRef}/service-point-areas`)
        return 'terminalReadStoreServicePointAreas';
      if (path === `/service-point-areas/${servicePointAreaRef}`) return 'terminalReadServicePointArea';
      if (path === `/stores/${terminalCredential.storeRef}/service-points`)
        return 'terminalReadStoreServicePoints';
      if (path === `/service-points/${servicePointRef}`) return 'terminalReadServicePoint';
      if (path === `/stores/${terminalCredential.storeRef}/organization-path`)
        return 'terminalReadStoreOrganizationPath';
      if (path === `/update-rules/projects/${projectRef}`) return 'terminalReadProjectUpdateRuleSnapshotPage';
      throw new Error(`Unexpected owner HTTP path in CP-01 Runtime proof: ${pathAndQuery}`);
    };

    const tdcCommands = [
      terminalActivationSucceededCommand,
      terminalTopicChangedCommand,
      executeTerminalHttpCommand,
      subscribeTerminalTopicCommand,
      unsubscribeTerminalTopicCommand,
      acceptTerminalTopicNotificationCommand,
    ] as const;
    const tdcActor = defineActor(terminalDataClientModuleName, 'cp-01-runtime-test', [
      onCommand(executeTerminalHttpCommand, async context => {
        const payload = context.command.payload as TerminalHttpCommandPayload;
        const operationId = operationForPath(payload.request.pathAndQuery);
        readOperations.add(operationId);
        if (operationId === 'terminalReadStoreOrganizationPath') {
          organizationReadStarted.resolve();
          await releaseOrganizationRead.promise;
        }
        if (
          readOperations.has('terminalReadStoreActiveContracts') &&
          readOperations.has('terminalReadStoreServicePointAreas') &&
          readOperations.has('terminalReadStoreServicePoints')
        )
          storeFollowupsStarted.resolve();
        const body = readBody(operationId);
        return {kind: 'response', status: 200, body} as StateJsonValue;
      }),
      onCommand(subscribeTerminalTopicCommand, context => {
        const request = context.command.payload;
        const subscription: TerminalTopicSubscription = Object.freeze({
          subscriptionId: `cp-01-${++subscriptionSequence}`,
          identityKey: `${request.subscriberKey}:${request.topicKey}:${request.ownerRef}`,
          subscriberKey: request.subscriberKey,
          topicKey: request.topicKey,
          ownerRef: request.ownerRef,
          acceptedTimeEpochMillis: request.initialTimeEpochMillis,
          pendingNotification: null,
        });
        context.dispatchAction({type: 'test/terminal-topic-subscribed', payload: subscription});
        return {status: 'subscribed'};
      }),
      onCommand(unsubscribeTerminalTopicCommand, context => {
        context.dispatchAction({type: 'test/terminal-topic-unsubscribed', payload: context.command.payload});
        return {status: 'unsubscribed'};
      }),
      onCommand(acceptTerminalTopicNotificationCommand, () => ({status: 'accepted'})),
    ]);
    const tdcModule: RuntimeModule = createRuntimeModule({
      moduleName: terminalDataClientModuleName,
      kind: 'owner',
      dependencies: Object.freeze([]),
      commandDefinitions: tdcCommands,
      actorDefinitions: [tdcActor],
      stateSlices: [terminalClientStateSlice, serverConfigTestSlice],
    });
    const updateModule: RuntimeModule = createRuntimeModule({
      moduleName: terminalUpdateModuleName,
      kind: 'owner',
      dependencies: Object.freeze([]),
      commandDefinitions: [requestTerminalUpdateCommand],
    });
    const storeModule = withoutAutomaticLifecycle(createStoreBasicModule());
    const projectModule = withoutAutomaticLifecycle(createProjectBasicModule());
    const runtime = createRuntime({
      localNodeId: 'node_cp_01' as CreateRuntimeInput['localNodeId'],
      modules: [tdcModule, updateModule, storeModule, projectModule],
      platformPorts: createRuntimePorts(persisted, () => inspectPersistedStore(), diagnosticLogs),
      state: {
        runtimeName: 'project-basic-cp-01-runtime-test',
        environmentMode: 'TEST',
        persistenceKey: 'project-basic-cp-01-runtime-test',
        persistenceDebounceMs: 0,
      },
    });

    try {
      await runtime.start();
    } catch (error) {
      const failure = runtime.failure;
      const cause = failure?.cause;
      const causeSummary =
        cause instanceof Error ? {name: cause.name, message: cause.message, stack: cause.stack} : cause;
      throw new Error(
        `CP01_RUNTIME_START_FAILURE ${JSON.stringify({
          error: error instanceof Error ? {name: error.name, message: error.message} : String(error),
          failure:
            failure === null
              ? null
              : {code: failure.code, message: failure.message, details: failure.details, cause: causeSummary},
          journal: runtime.journal.list(),
        })}`,
      );
    }
    let runtimeStateReady = true;
    inspectPersistedStore = () => {
      if (!runtimeStateReady) return;
      const state = runtime.getState();
      const contractIds = selectActiveContracts(state)?.value.map(item => item.id) ?? [];
      const areaIds = selectServicePointAreas(state)?.value.map(item => item.areaRef) ?? [];
      const pointIds = selectServicePoints(state)?.value.map(item => item.pointRef) ?? [];
      const contractPersisted = [...persisted.values()].some(value => value.includes(contractRef));
      const pointPersisted = [...persisted.values()].some(value => value.includes(servicePointRef));
      if (
        contractIds.includes(contractRef) &&
        areaIds.includes(servicePointAreaRef) &&
        pointIds.includes(servicePointRef) &&
        contractPersisted &&
        pointPersisted
      )
        storeFollowupsSaved.resolve();
    };
    const unsubscribe = runtime.subscribe(inspectPersistedStore);
    inspectPersistedStore();
    let initialization: ReturnType<typeof runtime.dispatchCommand> | undefined;
    try {
      initialization = runtime.dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {
        requestId: createRequestId(),
      });
      let organizationReadTimeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        organizationReadStarted.promise,
        new Promise<never>((_resolve, reject) => {
          organizationReadTimeout = setTimeout(() => {
            const state = runtime.getState();
            reject(
              new Error(
                `CP01_ORGANIZATION_READ_NOT_STARTED ${JSON.stringify({
                  operations: [...readOperations],
                  store: state[storeBasicSliceName],
                  project: state[projectBasicSliceName],
                  logs: diagnosticLogs,
                })}`,
              ),
            );
          }, 4_500);
        }),
      ]).finally(() => {
        if (organizationReadTimeout !== undefined) clearTimeout(organizationReadTimeout);
      });
      await Promise.all([storeFollowupsStarted.promise, storeFollowupsSaved.promise]);

      const state = runtime.getState();
      expect(readOperations.has('terminalReadStoreOrganizationPath')).toBe(true);
      expect(readOperations.has('terminalReadStoreActiveContracts')).toBe(true);
      expect(readOperations.has('terminalReadStoreServicePoints')).toBe(true);
      expect(selectStore(state)?.value).toMatchObject({id: terminalCredential.storeRef, name: 'Sample Store'});
      expect(selectStoreBasicLoadReadiness(state)).toMatchObject({storeStatus: 'flushed'});
      expect(selectActiveContracts(state)?.value.map(item => item.id)).toEqual([contractRef]);
      expect(selectServicePointAreas(state)?.value.map(item => item.areaRef)).toEqual([servicePointAreaRef]);
      expect(selectServicePoints(state)?.value.map(item => item.pointRef)).toEqual([servicePointRef]);
      expect([...persisted.values()].some(value => value.includes(contractRef))).toBe(true);
      expect([...persisted.values()].some(value => value.includes(servicePointRef))).toBe(true);
    } finally {
      runtimeStateReady = false;
      unsubscribe();
      releaseOrganizationRead.resolve();
      if (initialization !== undefined) await initialization;
    }
  });
});
