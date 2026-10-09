import {describe, expect, it} from 'vitest';
import type {ActorExecutionContext, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {
  readTerminalDataCommand,
  selectActivationState,
  selectTerminalTopicSubscriptions,
  terminalTopicChangedCommand,
  type TerminalReadOperationId,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  createStoreBasicModule,
  initializeStoreBasicCommand,
  initializeStoreServicePointsCommand,
  storeBasicInformationLoadedCommand,
  selectActiveContracts,
  selectServicePointAreas,
  selectServicePoints,
  selectStore,
  selectStoreBasicState,
  selectStoreBasicLoadReadiness,
} from '../src/index';
import {storeBasicReducer, storeBasicSliceName, storeBasicStateRegistration} from '../src/features/slices/slice';
import type {StoreBasicState} from '../src/types/types';

const binding = {
  terminalRef: 'terminal-1',
  storeRef: 'store-1',
  groupWorkspaceKey: 'workspace-1',
  bindingGeneration: 4,
};
const readBody = (operationId: TerminalReadOperationId): unknown => {
  switch (operationId) {
    case 'terminalReadStoreBasic':
      return {
        store: {id: 'store-1', name: 'Sample'},
        operatingRules: {catalogManagementEnabled: true},
        storeUpdatedAtEpochMillis: 10,
        operatingRulesUpdatedAtEpochMillis: 11,
      };
    case 'terminalReadStoreOrganizationPath':
      return {
        projectRef: 'project-1',
        projectName: 'Project',
        regionRef: 'region-1',
        regionName: 'Region',
        commercialGroupRef: 'group-1',
        commercialGroupName: 'Group',
        projectUpdatedAtEpochMillis: 12,
        regionUpdatedAtEpochMillis: 13,
        commercialGroupUpdatedAtEpochMillis: 14,
      };
    case 'terminalReadStoreActiveContracts':
      return {
        items: [{id: 'contract-1', updatedAt: 15}],
        collectionUpdatedAtEpochMillis: 15,
      };
    case 'terminalReadStoreServicePointAreas':
      return {
        items: [{areaRef: 'area-1', updatedAt: 16}],
        collectionUpdatedAtEpochMillis: 16,
      };
    case 'terminalReadStoreServicePoints':
      return {
        items: [{pointRef: 'point-1', updatedAt: 17}],
        collectionUpdatedAtEpochMillis: 17,
      };
    case 'terminalReadContract':
      return {contract: {id: 'contract-1', updatedAt: 15}, updatedAtEpochMillis: 15};
    case 'terminalReadServicePointArea':
      return {area: {areaRef: 'area-1', updatedAt: 16}, updatedAtEpochMillis: 16};
    case 'terminalReadServicePoint':
      return {servicePoint: {pointRef: 'point-1', updatedAt: 17}, updatedAtEpochMillis: 17};
  }
};

const activeCredential = () => {
  const state = {
    credential: {...binding, deviceId: 'device-1', credentialSecret: 'A'.repeat(43)},
    activationStatus: 'active',
    connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
    pendingActivations: {},
    heartbeatIntervalMs: null,
    nextPingSequence: 1,
    lastRttMs: 0,
    latencySamples: [],
    topicSubscriptions: {},
    acceptedTopicTimes: {},
  };
  expect(selectActivationState({'kernel.base.terminal-data-client.client': state} as unknown as StateRoot).status).toBe(
    'active',
  );
  return state;
};

const createActorHarness = (
  options: Readonly<{
    failOperations?: readonly TerminalReadOperationId[];
    failFirstReadOperations?: readonly TerminalReadOperationId[];
    failReadCallIndexes?: Partial<Readonly<Record<TerminalReadOperationId, readonly number[]>>>;
    deferredRead?: Readonly<{
      operationId: TerminalReadOperationId;
      callIndex: number;
      wait: Promise<void>;
      onStarted: () => void;
    }>;
    deferredFlush?: Readonly<{
      shouldDefer: (state: StoreBasicState) => boolean;
      wait: Promise<void>;
      onStarted: () => void;
    }>;
    readBodySequences?: Partial<Readonly<Record<TerminalReadOperationId, readonly unknown[]>>>;
    topicUnsubscribeResult?: StateJsonValue;
    topicAcceptResult?: StateJsonValue;
    persistedStoreBasicState?: StoreBasicState;
  }> = {},
) => {
  const module = createStoreBasicModule();
  const actor = module.actorDefinitions?.[0];
  if (actor === undefined) throw new Error('store-basic actor missing');
  let storeState = options.persistedStoreBasicState ?? storeBasicReducer(undefined, {type: 'test/init'});
  const tdcState = activeCredential() as ReturnType<typeof activeCredential> & {
    topicSubscriptions: Record<
      string,
      {
        subscriptionId: string;
        identityKey: string;
        subscriberKey: string;
        topicKey: string;
        ownerRef: string;
        acceptedTimeEpochMillis: number;
        pendingNotification: null;
      }
    >;
  };
  let instanceMode: 'MASTER' | 'SLAVE' = 'MASTER';
  let subscriptionCounter = 0;
  const calls: Array<Readonly<{name: string; payload: unknown; options?: Readonly<{requestId?: string}>}>> = [];
  const timeline: Array<Readonly<{kind: 'command' | 'flush'; name?: string; state?: typeof storeState}>> = [];
  const readCounts = new Map<TerminalReadOperationId, number>();
  let flushCount = 0;
  let deferredFlushUsed = false;
  const contextBase = {
    runtimeId: 'test-runtime',
    localNodeId: 'test-node',
    platformPorts: {logger: {scope: () => ({info: () => undefined, error: () => undefined})}},
    command: {
      commandName: initializeStoreBasicCommand.commandName,
      commandId: 'initialize',
      requestId: 'initialize',
      payload: {},
    },
    actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
    getState: () =>
      ({
        'kernel.base.runtime.instance-mode': {instanceMode},
        'kernel.base.terminal-data-client.client': tdcState,
        [storeBasicSliceName]: storeState,
      }) as StateRoot,
    dispatchAction: (action: unknown) => {
      storeState = storeBasicReducer(storeState, action as never);
      return action as never;
    },
    flushPersistence: async () => {
      flushCount += 1;
      timeline.push({kind: 'flush', state: storeState});
      if (!deferredFlushUsed && options.deferredFlush !== undefined && options.deferredFlush.shouldDefer(storeState)) {
        deferredFlushUsed = true;
        options.deferredFlush.onStarted();
        await options.deferredFlush.wait;
      }
      return {status: 'succeeded' as const};
    },
    subscribeState: () => () => undefined,
    requestApplicationReset: () => undefined,
  };
  const dispatchCommand = async (
    definition: {commandName: string},
    payload: unknown,
    dispatchOptions?: Readonly<{requestId?: string}>,
  ): Promise<unknown> => {
    calls.push(Object.freeze({name: definition.commandName, payload, options: dispatchOptions}));
    timeline.push({kind: 'command', name: definition.commandName});
    if (definition.commandName === readTerminalDataCommand.commandName) {
      const operationId = (payload as {operationId: TerminalReadOperationId}).operationId;
      const callIndex = readCounts.get(operationId) ?? 0;
      readCounts.set(operationId, callIndex + 1);
      if (options.deferredRead?.operationId === operationId && options.deferredRead.callIndex === callIndex) {
        options.deferredRead.onStarted();
        await options.deferredRead.wait;
      }
      if (
        options.failOperations?.includes(operationId) ||
        (callIndex === 0 && options.failFirstReadOperations?.includes(operationId)) ||
        options.failReadCallIndexes?.[operationId]?.includes(callIndex)
      ) {
        return {
          status: 'completed',
          actorResults: [
            {status: 'completed', result: {kind: 'failure', category: 'not-delivered', code: 'TEST_READ_FAILURE'}},
          ],
        };
      }
      const sequence = options.readBodySequences?.[operationId];
      const body = sequence?.[Math.min(callIndex, sequence.length - 1)] ?? readBody(operationId);
      return {status: 'completed', actorResults: [{status: 'completed', result: {kind: 'success', status: 200, body}}]};
    }
    if (definition.commandName.endsWith('.subscribe-topic')) {
      const request = payload as {
        subscriberKey: string;
        topicKey: string;
        ownerRef: string;
        initialTimeEpochMillis: number;
      };
      const subscriptionId = `test-subscription-${++subscriptionCounter}`;
      tdcState.topicSubscriptions[subscriptionId] = {
        subscriptionId,
        identityKey: `${request.subscriberKey}:${request.topicKey}:${request.ownerRef}`,
        subscriberKey: request.subscriberKey,
        topicKey: request.topicKey,
        ownerRef: request.ownerRef,
        acceptedTimeEpochMillis: request.initialTimeEpochMillis,
        pendingNotification: null,
      };
      return {status: 'completed', actorResults: [{status: 'completed', result: {status: 'subscribed'}}]};
    }
    if (definition.commandName.endsWith('.unsubscribe-topic')) {
      const request = payload as {subscriberKey: string; topicKey: string; ownerRef: string};
      if (
        options.topicUnsubscribeResult === undefined ||
        (typeof options.topicUnsubscribeResult === 'object' &&
          options.topicUnsubscribeResult !== null &&
          'status' in options.topicUnsubscribeResult &&
          ['unsubscribed', 'not-subscribed'].includes(String(options.topicUnsubscribeResult.status)))
      ) {
        for (const [id, subscription] of Object.entries(tdcState.topicSubscriptions)) {
          if (
            subscription.subscriberKey === request.subscriberKey &&
            subscription.topicKey === request.topicKey &&
            subscription.ownerRef === request.ownerRef
          )
            delete tdcState.topicSubscriptions[id];
        }
      }
      return {
        status: 'completed',
        actorResults: [{status: 'completed', result: options.topicUnsubscribeResult ?? {status: 'unsubscribed'}}],
      };
    }
    if (definition.commandName.endsWith('.accept-topic-notification')) {
      return {
        status: 'completed',
        actorResults: [{status: 'completed', result: options.topicAcceptResult ?? {status: 'accepted'}}],
      };
    }
    const handler = actor.handlers.find(candidate => candidate.commandName === definition.commandName);
    if (handler === undefined) return {status: 'completed', actorResults: [{status: 'completed', result: null}]};
    const commandContext = {
      ...contextBase,
      command: {
        commandName: definition.commandName,
        commandId: definition.commandName,
        requestId: dispatchOptions?.requestId ?? contextBase.command.requestId,
        payload,
      },
      dispatchCommand,
    } as unknown as ActorExecutionContext;
    const result = await handler.handle(commandContext);
    return {status: 'completed', actorResults: [{status: 'completed', result: (result ?? null) as StateJsonValue}]};
  };
  const context = {...contextBase, dispatchCommand} as unknown as ActorExecutionContext;
  return {
    actor,
    module,
    context,
    calls,
    timeline,
    dispatchCommand,
    getState: contextBase.getState,
    setInstanceMode: (mode: 'MASTER' | 'SLAVE') => {
      instanceMode = mode;
    },
    changeCredentialBinding: () => {
      tdcState.credential.bindingGeneration += 1;
    },
    topicSubscriptions: () => Object.values(tdcState.topicSubscriptions),
    getFlushCount: () => flushCount,
    rebuildStoreState: () => {
      storeState = storeBasicReducer(undefined, {type: 'test/reset'});
      for (const subscriptionId of Object.keys(tdcState.topicSubscriptions)) delete tdcState.topicSubscriptions[subscriptionId];
    },
  };
};

describe('store-basic feature owner', () => {
  it('dispatches its public startup command with a request identity', async () => {
    const module = createStoreBasicModule();
    const calls: unknown[][] = [];
    const context = {
      dispatchCommand: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve({status: 'completed'});
      },
      platformPorts: {logger: {scope: () => ({error: () => undefined})}},
    } as unknown as RuntimeModuleContext;

    module.install?.(context);
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(initializeStoreBasicCommand);
    expect(calls[0]?.[2]).toEqual({requestId: expect.stringMatching(/^req_/)});
  });

  it('reinitializes store-basic through its owner command after Runtime reset', async () => {
    const module = createStoreBasicModule();
    const calls: unknown[][] = [];
    await module.onApplicationReset?.({
      dispatchCommand: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve({status: 'completed'});
      },
      platformPorts: {logger: {scope: () => ({error: () => undefined})}},
    } as unknown as RuntimeModuleContext, {reason: 'test', previousState: {} as StateRoot} as never);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(initializeStoreBasicCommand);
    expect(calls[0]?.[2]).toEqual({requestId: expect.stringMatching(/^req_/) });
  });

  it('retries project readiness after an initial organization-path read failure', async () => {
    const harness = createActorHarness({failFirstReadOperations: ['terminalReadStoreOrganizationPath']});
    const initialize = harness.actor.handlers.find(item => item.commandName === initializeStoreBasicCommand.commandName);
    if (initialize === undefined) throw new Error('store-basic initialize handler missing');

    await expect(initialize.handle(harness.context)).resolves.toEqual({status: 'store-loaded'});
    expect(selectStoreBasicLoadReadiness(harness.getState()).projectStatus).toBe('failed');
    await expect(initialize.handle(harness.context)).resolves.toEqual({status: 'already-loaded'});

    const organizationReads = harness.calls.filter(call =>
      call.name === readTerminalDataCommand.commandName &&
      (call.payload as {operationId?: string}).operationId === 'terminalReadStoreOrganizationPath',
    );
    expect(organizationReads).toHaveLength(2);
    expect(selectStoreBasicLoadReadiness(harness.getState())).toMatchObject({
      storeStatus: 'flushed',
      projectStatus: 'flushed',
      projectRef: 'project-1',
    });
  });

  it('reloads store facts when Runtime reset rebuilt readiness but retained actor-local completion state', async () => {
    const harness = createActorHarness();
    const initialize = harness.actor.handlers.find(item => item.commandName === initializeStoreBasicCommand.commandName);
    if (initialize === undefined) throw new Error('store-basic initialize handler missing');

    await initialize.handle(harness.context);
    harness.rebuildStoreState();
    await expect(initialize.handle(harness.context)).resolves.toEqual({status: 'store-loaded'});

    const storeReads = harness.calls.filter(call =>
      call.name === readTerminalDataCommand.commandName &&
      (call.payload as {operationId?: string}).operationId === 'terminalReadStoreBasic',
    );
    expect(storeReads).toHaveLength(2);
    expect(selectStoreBasicLoadReadiness(harness.getState())).toMatchObject({
      storeStatus: 'flushed',
      projectStatus: 'flushed',
      projectRef: 'project-1',
    });
  });

  it('loads full business snapshots before subscribing to all current range and detail identities', async () => {
    const harness = createActorHarness();
    const handler = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    if (handler === undefined) throw new Error('store-basic initialize handler missing');
    await expect(handler.handle(harness.context)).resolves.toEqual({status: 'store-loaded'});

    const state = harness.getState();
    expect(selectStore(state)).toMatchObject({value: {id: 'store-1', name: 'Sample'}, updatedAtEpochMillis: 10});
    expect(selectActiveContracts(state)?.value.map(item => item.id)).toEqual(['contract-1']);
    expect(selectServicePointAreas(state)?.value.map(item => item.areaRef)).toEqual(['area-1']);
    expect(selectServicePoints(state)?.value.map(item => item.pointRef)).toEqual(['point-1']);
    const subscriptions = harness.calls.filter(call => call.name.endsWith('.subscribe-topic'));
    expect(harness.calls.every(call => call.options?.requestId === 'initialize')).toBe(true);
    expect(subscriptions.map(call => (call.payload as {topicKey: string}).topicKey).sort()).toEqual([
      'COMMERCIAL_GROUP',
      'CONTRACT',
      'PROJECT',
      'REGION',
      'SERVICE_POINT',
      'SERVICE_POINT_AREA',
      'SERVICE_POINT_AREA_COLLECTION',
      'SERVICE_POINT_COLLECTION',
      'STORE',
      'STORE_OPERATING_RULE',
      'VALID_CONTRACT_COLLECTION',
    ]);
    expect(harness.getFlushCount()).toBeGreaterThanOrEqual(4);
    expect(selectStoreBasicLoadReadiness(harness.getState())).toMatchObject({
      runtimeId: 'test-runtime',
      binding,
      storeStatus: 'flushed',
      projectStatus: 'flushed',
      projectRef: 'project-1',
    });
    const storePersistIndex = harness.timeline.findIndex(
      event => event.kind === 'flush' && event.state?.store !== null,
    );
    const servicePointCommandIndex = harness.timeline.findIndex(
      event => event.kind === 'command' && event.name === initializeStoreServicePointsCommand.commandName,
    );
    expect(storePersistIndex).toBeGreaterThanOrEqual(0);
    expect(servicePointCommandIndex).toBeGreaterThan(storePersistIndex);
  });

  it('does not subscribe or publish initialization after the binding changes during persistence flush', async () => {
    let releaseFlush!: () => void;
    const flushGate = new Promise<void>(resolve => {
      releaseFlush = resolve;
    });
    let markFlushStarted!: () => void;
    const flushStarted = new Promise<void>(resolve => {
      markFlushStarted = resolve;
    });
    const harness = createActorHarness({
      deferredFlush: {
        shouldDefer: state => state.store?.value.id === 'store-1',
        wait: flushGate,
        onStarted: markFlushStarted,
      },
    });
    const initialize = harness.actor.handlers.find(
      item => item.commandName === initializeStoreBasicCommand.commandName,
    );
    if (initialize === undefined) throw new Error('store-basic initialize handler missing');
    const operation = initialize.handle(harness.context);
    await flushStarted;
    harness.changeCredentialBinding();
    releaseFlush();
    await expect(operation).resolves.toEqual({status: 'stale-binding'});
    expect(harness.calls.filter(call => call.name.endsWith('.subscribe-topic'))).toHaveLength(0);
    expect(harness.calls.filter(call => call.name === storeBasicInformationLoadedCommand.commandName)).toHaveLength(0);
  });

  it('does not request or subscribe service-point data when the prerequisite store read fails', async () => {
    const harness = createActorHarness({failOperations: ['terminalReadStoreBasic']});
    const handler = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    if (handler === undefined) throw new Error('store-basic initialize handler missing');
    await expect(handler.handle(harness.context)).resolves.toEqual({status: 'store-read-failed'});
    const operationIds = harness.calls
      .filter(call => call.name === readTerminalDataCommand.commandName)
      .map(call => (call.payload as {operationId: string}).operationId);
    expect(operationIds).not.toContain('terminalReadStoreServicePointAreas');
    expect(operationIds).not.toContain('terminalReadStoreServicePoints');
    expect(
      harness.calls
        .filter(call => call.name.endsWith('.subscribe-topic'))
        .map(call => (call.payload as {topicKey: string}).topicKey),
    ).not.toContain('SERVICE_POINT_COLLECTION');
  });

  it('keeps store facts when a service-point partition read fails', async () => {
    const harness = createActorHarness({failOperations: ['terminalReadStoreServicePoints']});
    const handler = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    if (handler === undefined) throw new Error('store-basic initialize handler missing');
    await expect(handler.handle(harness.context)).resolves.toEqual({status: 'store-loaded'});

    const state = harness.getState();
    expect(selectStore(state)).toMatchObject({value: {id: 'store-1', name: 'Sample'}});
    expect(selectServicePointAreas(state)?.value.map(item => item.areaRef)).toEqual(['area-1']);
    expect(selectServicePoints(state)).toBeNull();
  });

  it('replaces a range and unsubscribes only the removed detail without refetching returned details', async () => {
    const contract = (id: string, updatedAt: number) => ({id, status: 'VALID', updatedAt});
    const range = (items: readonly ReturnType<typeof contract>[], collectionUpdatedAtEpochMillis: number) => ({
      items,
      collectionUpdatedAtEpochMillis,
    });
    const harness = createActorHarness({
      readBodySequences: {
        terminalReadStoreActiveContracts: [
          range([contract('A', 15), contract('B', 16)], 16),
          range([contract('A', 15), contract('C', 17)], 17),
        ],
      },
    });
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);
    const beforeUpdate = harness.calls.length;
    await topicChanged.handle({
      ...harness.context,
      command: {
        ...harness.context.command,
        commandName: terminalTopicChangedCommand.commandName,
        payload: {
          subscriberKey: 'kernel.feature.store-basic',
          terminalRef: binding.terminalRef,
          bindingGeneration: binding.bindingGeneration,
          notification: {
            notificationId: 'notification-2',
            subscriptionId: 'subscription-range',
            topicKey: 'VALID_CONTRACT_COLLECTION',
            ownerRef: binding.storeRef,
            topicTimeEpochMillis: 17,
          },
        },
      },
    } as ActorExecutionContext);

    expect(selectActiveContracts(harness.getState())?.value.map(item => item.id)).toEqual(['A', 'C']);
    const deltaCalls = harness.calls.slice(beforeUpdate);
    expect(
      deltaCalls
        .filter(call => call.name.endsWith('.unsubscribe-topic'))
        .map(call => (call.payload as {ownerRef: string}).ownerRef),
    ).toEqual(['B']);
    expect(
      deltaCalls
        .filter(call => call.name.endsWith('.subscribe-topic'))
        .map(call => (call.payload as {ownerRef: string}).ownerRef),
    ).toEqual(['C']);
    expect(
      deltaCalls
        .filter(call => call.name === readTerminalDataCommand.commandName)
        .map(call => (call.payload as {operationId: string}).operationId),
    ).toEqual(['terminalReadStoreActiveContracts']);
  });

  it('keeps a failed detail unsubscribe visible when the aggregate command completed', async () => {
    const contract = (id: string, updatedAt: number) => ({id, status: 'VALID', updatedAt});
    const harness = createActorHarness({
      topicUnsubscribeResult: {status: 'failed', reason: 'PERSISTENCE_FAILED'},
      readBodySequences: {
        terminalReadStoreActiveContracts: [
          {items: [contract('A', 15), contract('B', 16)], collectionUpdatedAtEpochMillis: 16},
          {items: [contract('A', 15), contract('C', 17)], collectionUpdatedAtEpochMillis: 17},
        ],
      },
    });
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);
    const result = await topicChanged.handle({
      ...harness.context,
      command: {
        ...harness.context.command,
        commandName: terminalTopicChangedCommand.commandName,
        payload: {
          subscriberKey: 'kernel.feature.store-basic',
          terminalRef: binding.terminalRef,
          bindingGeneration: binding.bindingGeneration,
          notification: {
            notificationId: 'notification-unsubscribe-failure',
            subscriptionId: 'subscription-range',
            topicKey: 'VALID_CONTRACT_COLLECTION',
            ownerRef: binding.storeRef,
            topicTimeEpochMillis: 17,
          },
        },
      },
    } as ActorExecutionContext);

    expect(result).toEqual({status: 'refreshed'});
    expect(selectActiveContracts(harness.getState())?.value.map(item => item.id)).toEqual(['A', 'C']);
    expect(selectStoreBasicState(harness.getState()).failures.CONTRACT).toBe('TOPIC_UNSUBSCRIBE_FAILED');
    expect(harness.calls.some(call => call.name.endsWith('.unsubscribe-topic'))).toBe(true);
  });

  it('does not clear a detail unsubscribe failure when applying the detail notification', async () => {
    const harness = createActorHarness({
      topicUnsubscribeResult: {status: 'failed', reason: 'PERSISTENCE_FAILED'},
      readBodySequences: {
        terminalReadStoreActiveContracts: [
          {items: [{id: 'A', status: 'VALID', updatedAt: 15}], collectionUpdatedAtEpochMillis: 16},
        ],
        terminalReadContract: [{contract: {id: 'A', status: 'VOIDED', updatedAt: 20}, updatedAtEpochMillis: 20}],
      },
    });
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);

    await expect(
      topicChanged.handle({
        ...harness.context,
        command: {
          ...harness.context.command,
          commandName: terminalTopicChangedCommand.commandName,
          payload: {
            subscriberKey: 'kernel.feature.store-basic',
            terminalRef: binding.terminalRef,
            bindingGeneration: binding.bindingGeneration,
            notification: {
              notificationId: 'notification-detail-unsubscribe-failure',
              subscriptionId: 'subscription-contract-A',
              topicKey: 'CONTRACT',
              ownerRef: 'A',
              topicTimeEpochMillis: 20,
            },
          },
        },
      } as ActorExecutionContext),
    ).resolves.toEqual({status: 'subscription-adjustment-failed'});

    expect(selectActiveContracts(harness.getState())?.value).toEqual([]);
    expect(selectStoreBasicState(harness.getState()).failures.CONTRACT).toBe('TOPIC_UNSUBSCRIBE_FAILED');
  });

  it.each([
    {status: 'failed', reason: 'PERSISTENCE_FAILED'},
    {status: 'rejected', reason: 'STALE_NOTIFICATION'},
  ] as const)(
    'does not report notification refresh success when the child accept result is $status',
    async acceptResult => {
      const harness = createActorHarness({topicAcceptResult: acceptResult});
      const initialize = harness.actor.handlers.find(
        candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
      );
      const topicChanged = harness.actor.handlers.find(
        candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
      );
      if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
      await initialize.handle(harness.context);
      const result = await topicChanged.handle({
        ...harness.context,
        command: {
          ...harness.context.command,
          commandName: terminalTopicChangedCommand.commandName,
          payload: {
            subscriberKey: 'kernel.feature.store-basic',
            terminalRef: binding.terminalRef,
            bindingGeneration: binding.bindingGeneration,
            notification: {
              notificationId: `notification-accept-${acceptResult.status}`,
              subscriptionId: 'subscription-store',
              topicKey: 'STORE',
              ownerRef: binding.storeRef,
              topicTimeEpochMillis: 20,
            },
          },
        },
      } as ActorExecutionContext);

      expect(result).toEqual({status: 'accept-failed'});
      expect(selectStoreBasicState(harness.getState()).failures.STORE).toBe('TOPIC_ACCEPT_FAILED');
      expect(harness.calls.some(call => call.name.endsWith('.accept-topic-notification'))).toBe(true);
    },
  );

  it('does not reinsert a range member from a late detail result after it was removed', async () => {
    const harness = createActorHarness({
      readBodySequences: {
        terminalReadStoreActiveContracts: [
          {
            items: [
              {id: 'A', status: 'VALID', updatedAt: 15},
              {id: 'B', status: 'VALID', updatedAt: 16},
            ],
            collectionUpdatedAtEpochMillis: 16,
          },
          {items: [{id: 'A', status: 'VALID', updatedAt: 15}], collectionUpdatedAtEpochMillis: 17},
        ],
        terminalReadContract: [{contract: {id: 'B', status: 'VALID', updatedAt: 16}, updatedAtEpochMillis: 16}],
      },
    });
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);
    const topicPayload = {
      subscriberKey: 'kernel.feature.store-basic',
      terminalRef: binding.terminalRef,
      bindingGeneration: binding.bindingGeneration,
      notification: {
        notificationId: 'notification-range-remove',
        subscriptionId: 'subscription-range',
        topicKey: 'VALID_CONTRACT_COLLECTION',
        ownerRef: binding.storeRef,
        topicTimeEpochMillis: 17,
      },
    };
    const contextWithPayload = (payload: unknown) =>
      ({
        ...harness.context,
        command: {...harness.context.command, commandName: terminalTopicChangedCommand.commandName, payload},
      }) as ActorExecutionContext;
    await topicChanged.handle(contextWithPayload(topicPayload));
    await topicChanged.handle(
      contextWithPayload({
        ...topicPayload,
        notification: {
          ...topicPayload.notification,
          notificationId: 'notification-late-detail',
          topicKey: 'CONTRACT',
          ownerRef: 'B',
        },
      }),
    );

    expect(selectActiveContracts(harness.getState())?.value.map(item => item.id)).toEqual(['A']);
  });

  it('does not process a topic notification addressed to another subscriber', async () => {
    const harness = createActorHarness();
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);

    const callsBefore = harness.calls.length;
    const stateBefore = harness.getState()[storeBasicSliceName];
    await expect(
      topicChanged.handle({
        ...harness.context,
        command: {
          ...harness.context.command,
          commandName: terminalTopicChangedCommand.commandName,
          payload: {
            subscriberKey: 'kernel.feature.another-consumer',
            terminalRef: binding.terminalRef,
            bindingGeneration: binding.bindingGeneration,
            notification: {
              notificationId: 'notification-other-subscriber',
              subscriptionId: 'subscription-other-subscriber',
              topicKey: 'STORE',
              ownerRef: binding.storeRef,
              topicTimeEpochMillis: 99,
            },
          },
        },
      } as ActorExecutionContext),
    ).resolves.toEqual({status: 'other-subscriber'});

    expect(harness.calls).toHaveLength(callsBefore);
    expect(harness.getState()[storeBasicSliceName]).toBe(stateBefore);
  });

  it('repeats current binding initialization after app restart despite persisted business state', async () => {
    const firstRun = createActorHarness();
    const initializeFirst = firstRun.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    if (initializeFirst === undefined) throw new Error('store-basic initialize handler missing');
    await initializeFirst.handle(firstRun.context);
    const persistedState = (firstRun.getState()[storeBasicSliceName] as StoreBasicState | undefined) ?? null;
    if (persistedState === null) throw new Error('store-basic persisted state missing');

    const restarted = createActorHarness({persistedStoreBasicState: persistedState});
    let startupDispatch: Promise<unknown> | undefined;
    restarted.module.install?.({
      moduleName: 'kernel.feature.store-basic',
      localNodeId: 'test-node',
      platformPorts: restarted.context.platformPorts,
      descriptors: [],
      getState: restarted.getState,
      flushPersistence: restarted.context.flushPersistence,
      subscribeState: restarted.context.subscribeState,
      registerResource: () => () => undefined,
      registerAsyncResource: () => () => Promise.resolve(),
      createFullSyncPayload: () => ({status: 'unavailable'}),
      applyAuthoritativeSync: () => ({status: 'unavailable'}),
      dispatchCommand: (definition: {commandName: string}, payload: unknown) => {
        startupDispatch = restarted.dispatchCommand(definition, payload);
        return startupDispatch as never;
      },
      installPeerDispatchGateway: () => undefined,
    } as unknown as RuntimeModuleContext);
    if (startupDispatch === undefined) throw new Error('module install did not dispatch initialization');
    await startupDispatch;

    const reads = restarted.calls
      .filter(call => call.name === readTerminalDataCommand.commandName)
      .map(call => (call.payload as {operationId: string}).operationId);
    expect(reads).toContain('terminalReadStoreBasic');
    expect(reads).toContain('terminalReadStoreServicePoints');
    expect(restarted.getState()[storeBasicSliceName]).toMatchObject(persistedState);
  });

  it('does not let hydrated store data bypass the current-cycle store-load gate', async () => {
    const firstRun = createActorHarness();
    const initialize = firstRun.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    if (initialize === undefined) throw new Error('store-basic initialize handler missing');
    await initialize.handle(firstRun.context);
    const persistedState = firstRun.getState()[storeBasicSliceName] as StoreBasicState;

    const restarted = createActorHarness({persistedStoreBasicState: persistedState});
    const result = (await restarted.dispatchCommand(initializeStoreServicePointsCommand, {binding})) as {
      readonly actorResults: readonly Readonly<{result?: unknown}>[];
    };

    expect(result.actorResults[0]?.result).toEqual({status: 'store-prerequisite-missing'});
    expect(
      restarted.calls
        .filter(call => call.name === readTerminalDataCommand.commandName)
        .map(call => (call.payload as {operationId: string}).operationId),
    ).not.toContain('terminalReadStoreServicePoints');
    expect(selectStore(restarted.getState())?.value).not.toBeNull();
  });

  it('does not repeat a completed load on duplicate init and retries an incomplete service-point load', async () => {
    const harness = createActorHarness({failFirstReadOperations: ['terminalReadStoreServicePoints']});
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    if (initialize === undefined) throw new Error('store-basic initialize handler missing');
    await initialize.handle(harness.context);
    await initialize.handle(harness.context);

    const reads = harness.calls
      .filter(call => call.name === readTerminalDataCommand.commandName)
      .map(call => (call.payload as {operationId: string}).operationId);
    expect(reads.filter(operationId => operationId === 'terminalReadStoreBasic')).toHaveLength(1);
    expect(reads.filter(operationId => operationId === 'terminalReadStoreServicePoints')).toHaveLength(2);
    expect(selectServicePoints(harness.getState())?.value.map(item => item.pointRef)).toEqual(['point-1']);
    expect(selectStoreBasicState(harness.getState()).failures.SERVICE_POINT_COLLECTION).toBeUndefined();
  });

  it('does not let an older failed topic read overwrite the newer notification result', async () => {
    let releaseOlderRead!: () => void;
    const olderReadGate = new Promise<void>(resolve => {
      releaseOlderRead = resolve;
    });
    let markOlderReadStarted!: () => void;
    const olderReadStarted = new Promise<void>(resolve => {
      markOlderReadStarted = resolve;
    });
    const newerStoreBody = {
      store: {id: 'store-1', name: 'Latest'},
      operatingRules: {catalogManagementEnabled: true},
      storeUpdatedAtEpochMillis: 40,
      operatingRulesUpdatedAtEpochMillis: 41,
    };
    const harness = createActorHarness({
      deferredRead: {
        operationId: 'terminalReadStoreBasic',
        callIndex: 1,
        wait: olderReadGate,
        onStarted: markOlderReadStarted,
      },
      failReadCallIndexes: {terminalReadStoreBasic: [1]},
      readBodySequences: {terminalReadStoreBasic: [readBody('terminalReadStoreBasic'), newerStoreBody, newerStoreBody]},
    });
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);
    const eventContext = (notificationId: string) =>
      ({
        ...harness.context,
        command: {
          ...harness.context.command,
          commandName: terminalTopicChangedCommand.commandName,
          payload: {
            subscriberKey: 'kernel.feature.store-basic',
            terminalRef: binding.terminalRef,
            bindingGeneration: binding.bindingGeneration,
            notification: {
              notificationId,
              subscriptionId: 'subscription-store',
              topicKey: 'STORE',
              ownerRef: binding.storeRef,
              topicTimeEpochMillis: 40,
            },
          },
        },
      }) as ActorExecutionContext;

    const olderResult = topicChanged.handle(eventContext('notification-older'));
    await olderReadStarted;
    await expect(topicChanged.handle(eventContext('notification-newer'))).resolves.toEqual({status: 'refreshed'});
    releaseOlderRead();
    await expect(olderResult).resolves.toEqual({status: 'stale-result'});

    expect(selectStore(harness.getState())?.value.name).toBe('Latest');
    expect(selectStoreBasicState(harness.getState()).failures.STORE).toBeUndefined();
    const acceptedIds = harness.calls
      .filter(call => call.name.endsWith('.accept-topic-notification'))
      .map(call => (call.payload as {notificationId: string}).notificationId);
    expect(acceptedIds).toEqual(['notification-newer']);
  });

  it('does not apply an older collection subscription diff after its persistence wait is superseded', async () => {
    let releaseOlderFlush!: () => void;
    const olderFlushGate = new Promise<void>(resolve => {
      releaseOlderFlush = resolve;
    });
    let markOlderFlushStarted!: () => void;
    const olderFlushStarted = new Promise<void>(resolve => {
      markOlderFlushStarted = resolve;
    });
    const contract = (id: string, updatedAt: number) => ({id, status: 'VALID', updatedAt});
    const harness = createActorHarness({
      deferredFlush: {
        shouldDefer: state => state.activeContracts?.value.some(item => item.id === 'contract-old') ?? false,
        wait: olderFlushGate,
        onStarted: markOlderFlushStarted,
      },
      readBodySequences: {
        terminalReadStoreActiveContracts: [
          {items: [contract('contract-1', 15)], collectionUpdatedAtEpochMillis: 15},
          {items: [contract('contract-1', 15), contract('contract-old', 16)], collectionUpdatedAtEpochMillis: 16},
          {items: [contract('contract-1', 15), contract('contract-new', 17)], collectionUpdatedAtEpochMillis: 17},
        ],
      },
    });
    const initialize = harness.actor.handlers.find(
      candidate => candidate.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      candidate => candidate.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);
    const eventContext = (notificationId: string) =>
      ({
        ...harness.context,
        command: {
          ...harness.context.command,
          commandName: terminalTopicChangedCommand.commandName,
          payload: {
            subscriberKey: 'kernel.feature.store-basic',
            terminalRef: binding.terminalRef,
            bindingGeneration: binding.bindingGeneration,
            notification: {
              notificationId,
              subscriptionId: 'contracts-collection',
              topicKey: 'VALID_CONTRACT_COLLECTION',
              ownerRef: binding.storeRef,
              topicTimeEpochMillis: 17,
            },
          },
        },
      }) as ActorExecutionContext;

    const olderResult = topicChanged.handle(eventContext('notification-contract-old'));
    await olderFlushStarted;
    await expect(topicChanged.handle(eventContext('notification-contract-new'))).resolves.toEqual({
      status: 'refreshed',
    });
    releaseOlderFlush();
    await expect(olderResult).resolves.toEqual({status: 'stale-result'});

    expect(selectActiveContracts(harness.getState())?.value.map(item => item.id)).toEqual([
      'contract-1',
      'contract-new',
    ]);
    expect(
      harness.calls
        .filter(call => call.name.endsWith('.subscribe-topic'))
        .map(call => (call.payload as {ownerRef: string}).ownerRef),
    ).not.toContain('contract-old');
  });

  it('reconciles the current subscription selector when a newer range retains an unsubscribed addition', async () => {
    let releaseOlderFlush!: () => void;
    const olderFlushGate = new Promise<void>(resolve => {
      releaseOlderFlush = resolve;
    });
    let markOlderFlushStarted!: () => void;
    const olderFlushStarted = new Promise<void>(resolve => {
      markOlderFlushStarted = resolve;
    });
    const contract = (id: string, updatedAt: number) => ({id, status: 'VALID', updatedAt});
    const body = {
      items: [contract('contract-1', 15), contract('contract-new', 17)],
      collectionUpdatedAtEpochMillis: 17,
    };
    const harness = createActorHarness({
      deferredFlush: {
        shouldDefer: state => state.activeContracts?.value.some(item => item.id === 'contract-new') ?? false,
        wait: olderFlushGate,
        onStarted: markOlderFlushStarted,
      },
      readBodySequences: {
        terminalReadStoreActiveContracts: [
          {items: [contract('contract-1', 15)], collectionUpdatedAtEpochMillis: 15},
          body,
          body,
        ],
      },
    });
    const initialize = harness.actor.handlers.find(
      item => item.commandName === initializeStoreBasicCommand.commandName,
    );
    const topicChanged = harness.actor.handlers.find(
      item => item.commandName === terminalTopicChangedCommand.commandName,
    );
    if (initialize === undefined || topicChanged === undefined) throw new Error('store-basic handler missing');
    await initialize.handle(harness.context);
    const eventContext = (notificationId: string) =>
      ({
        ...harness.context,
        command: {
          ...harness.context.command,
          commandName: terminalTopicChangedCommand.commandName,
          payload: {
            subscriberKey: 'kernel.feature.store-basic',
            terminalRef: binding.terminalRef,
            bindingGeneration: binding.bindingGeneration,
            notification: {
              notificationId,
              subscriptionId: 'contracts-collection',
              topicKey: 'VALID_CONTRACT_COLLECTION',
              ownerRef: binding.storeRef,
              topicTimeEpochMillis: 17,
            },
          },
        },
      }) as ActorExecutionContext;
    const oldRefresh = topicChanged.handle(eventContext('notification-contract-old'));
    await olderFlushStarted;
    await expect(topicChanged.handle(eventContext('notification-contract-new'))).resolves.toEqual({
      status: 'refreshed',
    });
    releaseOlderFlush();
    await expect(oldRefresh).resolves.toEqual({status: 'stale-result'});

    expect(
      selectTerminalTopicSubscriptions(harness.getState()).filter(
        item =>
          item.subscriberKey === 'kernel.feature.store-basic' &&
          item.topicKey === 'CONTRACT' &&
          item.ownerRef === 'contract-new',
      ),
    ).toHaveLength(1);
    expect(
      harness.calls.filter(
        call =>
          call.name.endsWith('.subscribe-topic') &&
          (call.payload as {topicKey: string; ownerRef: string}).topicKey === 'CONTRACT' &&
          (call.payload as {ownerRef: string}).ownerRef === 'contract-new',
      ),
    ).toHaveLength(1);
  });
});
