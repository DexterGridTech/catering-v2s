import {unavailableRemoteControlPort} from '@catering-v2s/kernel-base-platform-ports';
import {describe, expect, it} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  createRuntime,
  defineActor,
  onCommand,
  type CreateRuntimeInput,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import {defineStateRuntimeSlice, type StateJsonValue} from '@catering-v2s/kernel-base-state';
import {
  acceptTerminalTopicNotificationCommand,
  moduleName as terminalDataClientModuleName,
  readTerminalDataCommand,
  subscribeTerminalTopicCommand,
  terminalActivationSucceededCommand,
  terminalTopicChangedCommand,
  unsubscribeTerminalTopicCommand,
  type TerminalClientState,
  type TerminalDataReadPayload,
  type TerminalReadOperationId,
  type TerminalTopicSubscription,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName as terminalUpdateModuleName, requestTerminalUpdateCommand} from '@catering-v2s/kernel-base-terminal-update';
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

const initialTerminalClientState = Object.freeze({
  credential: terminalCredential,
  credentialRevision: 1,
  credentialReadyRevision: null,
  credentialReadyInstanceMode: null,
  pendingActivations: Object.freeze({}),
  activationStatus: 'active',
  connection: Object.freeze({status: 'stopped', addressName: null, nodeId: null, sessionId: null, lastCloseReason: null}),
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
      const request = (action as unknown as {payload: {subscriberKey: string; topicKey: string; ownerRef: string}}).payload;
      const topicSubscriptions = Object.fromEntries(
        Object.entries(state.topicSubscriptions).filter(([, subscription]) =>
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

const completion = <TValue>(value: TValue) => ({status: 'succeeded', value, completedAt: 1 as never});

const createRuntimePorts = (
  persisted: Map<string, string>,
  onPlainStorageWrite: () => void,
): CreateRuntimeInput['platformPorts'] => {
  const createStorage = (values: Map<string, string>) => ({
    read: async ({key}: {key: string}) => completion(values.has(key)
      ? {state: 'found', value: values.get(key) ?? ''}
      : {state: 'missing'}),
    write: async ({key, value}: {key: string; value: string}) => {
      values.set(key, value);
      if (values === persisted) onPlainStorageWrite();
      return completion({completed: true});
    },
    remove: async ({key}: {key: string}) => {
      values.delete(key);
      return completion({completed: true});
    },
    readMany: async ({keys}: {keys: readonly string[]}) => completion(keys.map(key => ({
      key,
      result: values.has(key) ? {state: 'found' as const, value: values.get(key) ?? ''} : {state: 'missing' as const},
    }))),
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
  logger = {
    debug: () => logResult,
    info: () => logResult,
    warn: () => logResult,
    error: () => logResult,
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
  it('starts and persists store follow-up reads while the independent organization read is still pending', async () => {
    const organizationReadStarted = deferred<void>();
    const releaseOrganizationRead = deferred<void>();
    const storeFollowupsStarted = deferred<void>();
    const readOperations = new Set<TerminalReadOperationId>();
    const persisted = new Map<string, string>();
    const storeFollowupsSaved = deferred<void>();
    let inspectPersistedStore: () => void = () => {};
    let subscriptionSequence = 0;

    const readBody = (operationId: TerminalReadOperationId): StateJsonValue => {
      switch (operationId) {
        case 'terminalReadStoreBasic':
          return {
            store: {id: terminalCredential.storeRef, name: 'Sample Store', groupWorkspaceKey: terminalCredential.groupWorkspaceKey,
              project: {id: 'project-1', name: 'Sample Project'}},
            operatingRules: {catalogManagementEnabled: true},
            storeUpdatedAtEpochMillis: 10,
            operatingRulesUpdatedAtEpochMillis: 11,
          };
        case 'terminalReadStoreActiveContracts':
          return {items: [{id: 'contract-1', updatedAt: 15}], collectionUpdatedAtEpochMillis: 15};
        case 'terminalReadContract':
          return {contract: {id: 'contract-1', updatedAt: 15}, updatedAtEpochMillis: 15};
        case 'terminalReadStoreServicePointAreas':
          return {items: [{areaRef: 'area-1', updatedAt: 16}], collectionUpdatedAtEpochMillis: 16};
        case 'terminalReadServicePointArea':
          return {area: {areaRef: 'area-1', updatedAt: 16}, updatedAtEpochMillis: 16};
        case 'terminalReadStoreServicePoints':
          return {items: [{pointRef: 'point-1', updatedAt: 17}], collectionUpdatedAtEpochMillis: 17};
        case 'terminalReadServicePoint':
          return {servicePoint: {pointRef: 'point-1', updatedAt: 17}, updatedAtEpochMillis: 17};
        case 'terminalReadStoreOrganizationPath':
          return {
            projectRef: 'project-1', projectName: 'Sample Project', regionRef: 'region-1', regionName: 'Sample Region',
            commercialGroupRef: 'group-1', commercialGroupName: 'Sample Group',
            projectUpdatedAtEpochMillis: 20, regionUpdatedAtEpochMillis: 21, commercialGroupUpdatedAtEpochMillis: 22,
          };
        case 'terminalReadProjectUpdateRuleSnapshotPage':
          return {items: [], collectionHash: 'a'.repeat(64), nextCursor: null};
        default:
          throw new Error(`Unexpected terminal read in CP-01 Runtime proof: ${operationId}`);
      }
    };

    const tdcCommands = [
      terminalActivationSucceededCommand,
      terminalTopicChangedCommand,
      readTerminalDataCommand,
      subscribeTerminalTopicCommand,
      unsubscribeTerminalTopicCommand,
      acceptTerminalTopicNotificationCommand,
    ] as const;
    const tdcActor = defineActor(terminalDataClientModuleName, 'cp-01-runtime-test', [
      onCommand(readTerminalDataCommand, async context => {
        const operationId = context.command.payload.operationId;
        readOperations.add(operationId);
        if (operationId === 'terminalReadStoreOrganizationPath') {
          organizationReadStarted.resolve();
          await releaseOrganizationRead.promise;
        }
        if (
          readOperations.has('terminalReadStoreActiveContracts') &&
          readOperations.has('terminalReadStoreServicePointAreas') &&
          readOperations.has('terminalReadStoreServicePoints')
        ) storeFollowupsStarted.resolve();
        const body = readBody(operationId);
        return {kind: 'success', status: 200, body} as StateJsonValue;
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
    const tdcModule: RuntimeModule = Object.freeze({
      moduleName: terminalDataClientModuleName,
      kind: 'owner',
      dependencies: Object.freeze([]),
      commands: tdcCommands.map(command => ({name: command.commandName, visibility: command.visibility})),
      commandDefinitions: tdcCommands,
      actors: [{name: tdcActor.actorName}],
      actorDefinitions: [tdcActor],
      slices: [{name: terminalClientSliceName, persistIntent: 'never' as const}],
      stateSlices: [terminalClientStateSlice],
    });
    const updateModule: RuntimeModule = Object.freeze({
      moduleName: terminalUpdateModuleName,
      kind: 'owner',
      dependencies: Object.freeze([]),
      commands: [{name: requestTerminalUpdateCommand.commandName, visibility: requestTerminalUpdateCommand.visibility}],
      commandDefinitions: [requestTerminalUpdateCommand],
    });
    const storeModule = withoutAutomaticLifecycle(createStoreBasicModule());
    const projectModule = withoutAutomaticLifecycle(createProjectBasicModule());
    const runtime = createRuntime({
      localNodeId: 'node_cp_01' as CreateRuntimeInput['localNodeId'],
      modules: [tdcModule, updateModule, storeModule, projectModule],
      platformPorts: createRuntimePorts(persisted, () => inspectPersistedStore()),
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
      const causeSummary = cause instanceof Error
        ? {name: cause.name, message: cause.message, stack: cause.stack}
        : cause;
      throw new Error(`CP01_RUNTIME_START_FAILURE ${JSON.stringify({
        error: error instanceof Error ? {name: error.name, message: error.message} : String(error),
        failure: failure === null ? null : {code: failure.code, message: failure.message, details: failure.details, cause: causeSummary},
        journal: runtime.journal.list(),
      })}`);
    }
    let runtimeStateReady = true;
    inspectPersistedStore = () => {
      if (!runtimeStateReady) return;
      const state = runtime.getState();
      const contractIds = selectActiveContracts(state)?.value.map(item => item.id) ?? [];
      const areaIds = selectServicePointAreas(state)?.value.map(item => item.areaRef) ?? [];
      const pointIds = selectServicePoints(state)?.value.map(item => item.pointRef) ?? [];
      const contractPersisted = [...persisted.values()].some(value => value.includes('contract-1'));
      const pointPersisted = [...persisted.values()].some(value => value.includes('point-1'));
      if (contractIds.includes('contract-1') && areaIds.includes('area-1') && pointIds.includes('point-1') &&
        contractPersisted && pointPersisted) storeFollowupsSaved.resolve();
    };
    const unsubscribe = runtime.subscribe(inspectPersistedStore);
    inspectPersistedStore();
    let initialization: ReturnType<typeof runtime.dispatchCommand> | undefined;
    try {
      initialization = runtime.dispatchCommand(initializeStoreBasicCommand, Object.freeze({}), {requestId: createRequestId()});
      await organizationReadStarted.promise;
      await Promise.all([storeFollowupsStarted.promise, storeFollowupsSaved.promise]);

      const state = runtime.getState();
      expect(readOperations.has('terminalReadStoreOrganizationPath')).toBe(true);
      expect(readOperations.has('terminalReadStoreActiveContracts')).toBe(true);
      expect(readOperations.has('terminalReadStoreServicePoints')).toBe(true);
      expect(selectStore(state)?.value).toMatchObject({id: terminalCredential.storeRef, name: 'Sample Store'});
      expect(selectStoreBasicLoadReadiness(state)).toMatchObject({storeStatus: 'flushed'});
      expect(selectActiveContracts(state)?.value.map(item => item.id)).toEqual(['contract-1']);
      expect(selectServicePointAreas(state)?.value.map(item => item.areaRef)).toEqual(['area-1']);
      expect(selectServicePoints(state)?.value.map(item => item.pointRef)).toEqual(['point-1']);
      expect([...persisted.values()].some(value => value.includes('contract-1'))).toBe(true);
      expect([...persisted.values()].some(value => value.includes('point-1'))).toBe(true);
    } finally {
      runtimeStateReady = false;
      unsubscribe();
      releaseOrganizationRead.resolve();
      if (initialization !== undefined) await initialization;
    }
  });
});
