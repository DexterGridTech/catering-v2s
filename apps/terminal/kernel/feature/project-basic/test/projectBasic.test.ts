import {describe, expect, it} from 'vitest';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {
  executeTerminalHttpCommand,
  selectActivationState,
  selectTerminalTopicSubscriptions,
  type TerminalTopicSubscription,
  type TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import type {
  TerminalOperationId,
  TerminalStoreOrganizationPathRead,
} from '../src/generated/terminalApi';
import {requestTerminalUpdateCommand, type TerminalUpdateTask} from '@catering-v2s/kernel-base-terminal-update';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import {
  storeBasicInformationLoadedCommand,
  storeBasicSliceName,
  type StoreBasicBinding,
  type StoreBasicState,
} from '@catering-v2s/kernel-feature-store-basic';
import {selectCommercialGroup} from '../src/selectors/selectCommercialGroup';
import {selectProject} from '../src/selectors/selectProject';
import {selectProjectBasicLoadReadiness} from '../src/selectors/selectProjectBasicLoadReadiness';
import {selectProjectBasicState} from '../src/selectors/selectProjectBasicState';
import {selectProjectOrganizationPath} from '../src/selectors/selectProjectOrganizationPath';
import {selectProjectBasicTopicState} from '../src/selectors/selectProjectBasicTopicState';
import {selectProjectTerminalUpdateContextFacts} from '../src/selectors/selectProjectTerminalUpdateContextFacts';
import {selectProjectFixedTerminalUpdateContextFacts} from '../src/selectors/selectProjectFixedTerminalUpdateContextFacts';
import {selectProjectTerminalUpdateCandidate} from '../src/selectors/selectProjectTerminalUpdateCandidate';
import {selectCurrentProjectTerminalUpdateTarget} from '../src/selectors/selectCurrentProjectTerminalUpdateTarget';
import {fixedTargetFromProjectCandidate} from '../src/selectors/fixedTargetFromProjectCandidate';
import {selectProjectTerminalUpdateRules} from '../src/selectors/selectProjectTerminalUpdateRules';
import {selectRegion} from '../src/selectors/selectRegion';
import {createProjectBasicActor} from '../src/features/actors/projectBasicActor';
import {evaluateProjectTerminalUpdateCommand} from '../src/declarations/commands';
import {
  getProjectBasicSyncEntries,
  initialProjectBasicState,
  projectBasicReducer,
  projectBasicSliceName,
} from '../src/features/slices/projectBasicState';
import {refreshProjectBasicTopicCommand, refreshProjectTerminalUpdateRulesCommand} from '../src/declarations/commands';
import {createProjectBasicModule} from '../src/application/module';
import type {ProjectBasicState} from '../src/types/types';

type TerminalReadOperationId = Extract<TerminalOperationId, `terminalRead${string}`>;
const storeRef = '00000000-0000-4000-8000-000000000014';
const projectRef = '00000000-0000-4000-8000-000000000011';
const regionRef = '00000000-0000-4000-8000-000000000012';
const commercialGroupRef = '00000000-0000-4000-8000-000000000013';
const fullArtifactRef = '00000000-0000-4000-8000-000000000015';
const hotArtifactRef = '00000000-0000-4000-8000-000000000016';
const operationForPayload = (payload: unknown): TerminalReadOperationId => {
  const path = (payload as {request: {pathAndQuery: string}}).request.pathAndQuery.split('?', 1)[0];
  if (/^\/stores\/[^/]+\/organization-path$/.test(path)) return 'terminalReadStoreOrganizationPath';
  if (/^\/update-rules\/projects\/[^/]+$/.test(path)) return 'terminalReadProjectUpdateRuleSnapshotPage';
  throw new Error(`Unexpected project owner path: ${path}`);
};

const binding: StoreBasicBinding = Object.freeze({
  terminalRef: 'terminal-1',
  storeRef,
  groupWorkspaceKey: 'workspace-1',
  bindingGeneration: 7,
});
const organizationPath: TerminalStoreOrganizationPathRead = Object.freeze({
  projectRef,
  projectName: 'Project',
  regionRef,
  regionName: 'Region',
  commercialGroupRef,
  commercialGroupName: 'Group',
  projectUpdatedAtEpochMillis: 101,
  regionUpdatedAtEpochMillis: 102,
  commercialGroupUpdatedAtEpochMillis: 103,
});
const artifact = (kind: 'FULL' | 'HOT') =>
  Object.freeze({
    artifactRef: kind === 'FULL' ? fullArtifactRef : hotArtifactRef,
    kind,
    applicationId: 'com.example.console',
    runtimeVersion: '1.0.0',
    nativeBuildNumber: 3,
    apkVersion: '3.0.0',
    jsVersion: '3.0.0',
    publicationId: 'b'.repeat(64),
    apkSha256: kind === 'FULL' ? 'c'.repeat(64) : null,
    zipSha256: 'd'.repeat(64),
    byteSize: 128,
    createdAtEpochMillis: 201,
  });
const ruleItem = Object.freeze({
  ruleRef: '10000000-0000-4000-8000-000000000007',
  targetMode: 'STORE_REFS',
  storeRefs: [storeRef],
  applicationId: 'com.example.console',
  createdAtEpochMillis: 201,
  full: artifact('FULL'),
  hot: null,
  nSeconds: 300,
  hotStrategy: null,
  mSeconds: null,
  description: null,
});
const snapshotPage = Object.freeze({items: [ruleItem], collectionHash: 'a'.repeat(64), nextCursor: null});
const successfulPersistenceResult = () => ({status: 'succeeded' as const, writtenKeys: [], removedKeys: []});
const failedPersistenceResult = () => ({
  status: 'failed' as const,
  writtenKeys: [],
  removedKeys: [],
  dirtyKeys: [],
  failures: [],
});

const createHarness = () => {
  const actor = createProjectBasicActor()[0];
  if (actor === undefined) throw new Error('project-basic actor missing');
  let projectState = projectBasicReducer(undefined, {type: 'test/init'});
  let instanceMode: 'MASTER' | 'SLAVE' = 'MASTER';
  let storeState = {
    binding,
    loadReadiness: Object.freeze({runtimeId: 'runtime-1', binding, storeStatus: 'flushed'}),
    store: Object.freeze({
      value: Object.freeze({id: storeRef, groupWorkspaceKey: 'workspace-1', project: {id: projectRef}}),
      updatedAtEpochMillis: 100,
    }),
  } as unknown as StoreBasicState;
  const clientState = {
    credential: {...binding, deviceId: 'device-1', credentialSecret: 'secret'},
    credentialRevision: 1,
    credentialReadyRevision: 1,
    credentialReadyInstanceMode: 'MASTER',
    activationStatus: 'active',
    connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null},
    pendingActivations: {},
    heartbeatIntervalMs: null,
    nextPingSequence: 1,
    lastRttMs: 0,
    latencySamples: [],
    topicSubscriptions: {} as Record<string, TerminalTopicSubscription>,
    acceptedTopicTimes: {},
  };
  let currentTask: TerminalUpdateTask | null = null;
  const updateState = {
    get currentTask() {
      return currentTask;
    },
    actualVersions: {
      applicationId: 'com.example.console',
      nativeVersion: '2.0.0',
      nativeBuildNumber: 2,
      runtimeVersion: '1.0.0',
      bundleVersion: '2.0.0',
      publicationId: 'a'.repeat(64),
      bootId: 'boot-1',
      entryKind: 'embedded',
    },
  };
  let subscriptionSequence = 0;
  let failOrganizationRead = false;
  let organizationPathRead = organizationPath;
  let organizationPathReader: (() => Promise<typeof organizationPath>) | null = null;
  let failedSubscriptionOwnerRef: string | null = null;
  let rejectRuleSnapshotReads = false;
  let acceptOutcomeStatus = 'accepted';
  let updateRequestResult: StateJsonValue = {status: 'no-update'};
  let flushPersistence: ActorExecutionContext['flushPersistence'] = async () => successfulPersistenceResult();
  const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
  const requestedTargets: unknown[] = [];
  const logEntries: unknown[] = [];
  const getState = (): StateRoot =>
    ({
      'kernel.base.runtime.instance-mode': {instanceMode},
      'kernel.base.terminal-data-client.client': clientState,
      'kernel.base.terminal-update.state': updateState,
      [serverConfigSliceName]: {selectedSpace: 'development', serviceRevisions: {business: 0}},
      [topologySliceName]: {
        peerReachable: instanceMode === 'SLAVE',
        peerIdentity: instanceMode === 'SLAVE' ? {moduleName: 'sample-console', instanceMode: 'MASTER'} : null,
        peerStateSyncConnectionId: instanceMode === 'SLAVE' ? 'peer-connection-1' : null,
        peerAppliedStateSyncRevisions:
          instanceMode === 'SLAVE'
            ? {[serverConfigSliceName]: 1, [storeBasicSliceName]: 1, [projectBasicSliceName]: 1}
            : {},
        peerFailedStateSyncRevisions: {},
      },
      [storeBasicSliceName]: storeState,
      [projectBasicSliceName]: projectState,
    }) as unknown as StateRoot;
  const success = (result: StateJsonValue) => ({status: 'completed', actorResults: [{status: 'completed', result}]});
  const dispatchCommand = async (definition: {commandName: string}, payload: unknown): Promise<unknown> => {
    calls.push(Object.freeze({name: definition.commandName, payload}));
    if (definition.commandName === executeTerminalHttpCommand.commandName) {
      const operationId = operationForPayload(payload);
      if (operationId === 'terminalReadStoreOrganizationPath' && failOrganizationRead)
        return success({kind: 'failure', category: 'delivered-failure', code: 'ORGANIZATION_PATH_UNAVAILABLE'});
      if (operationId === 'terminalReadProjectUpdateRuleSnapshotPage' && rejectRuleSnapshotReads)
        return success({
          kind: 'response',
          status: 409,
          body: {
            type: 'urn:problem:terminal-update-snapshot-changed',
            title: 'Snapshot changed',
            status: 409,
            detail: 'The current update-rule snapshot changed.',
            errorCode: 'TERMINAL_UPDATE_SNAPSHOT_CHANGED',
            correlationId: 'test-correlation-1',
          },
        });
      const body =
        operationId === 'terminalReadStoreOrganizationPath'
          ? organizationPathReader === null
            ? organizationPathRead
            : await organizationPathReader()
          : operationId === 'terminalReadProjectUpdateRuleSnapshotPage'
            ? snapshotPage
            : null;
      return body === null
        ? success({kind: 'failure', category: 'not-delivered', code: 'UNEXPECTED_READ'})
        : success({kind: 'response', status: 200, body: body as unknown as StateJsonValue});
    }
    if (definition.commandName === requestTerminalUpdateCommand.commandName) {
      requestedTargets.push((payload as {target: unknown}).target);
      return success(updateRequestResult);
    }
    if (definition.commandName.endsWith('.subscribe-topic')) {
      const request = payload as {
        subscriberKey: string;
        topicKey: string;
        ownerRef: string;
        initialTimeEpochMillis: number;
      };
      if (request.ownerRef === failedSubscriptionOwnerRef) return success({status: 'rejected'});
      const subscriptionId = `subscription-${++subscriptionSequence}`;
      clientState.topicSubscriptions[subscriptionId] = {
        subscriptionId,
        identityKey: `${request.subscriberKey}:${request.topicKey}:${request.ownerRef}`,
        subscriberKey: request.subscriberKey,
        topicKey: request.topicKey as TerminalTopicKey,
        ownerRef: request.ownerRef,
        acceptedTimeEpochMillis: request.initialTimeEpochMillis,
        pendingNotification: null,
      };
      return success({status: 'subscribed'});
    }
    if (definition.commandName.endsWith('.unsubscribe-topic')) return success({status: 'not-subscribed'});
    if (definition.commandName.endsWith('.accept-topic-notification')) return success({status: acceptOutcomeStatus});
    return {status: 'completed', actorResults: []};
  };
  const makeContext = (commandName: string, payload: unknown): ActorExecutionContext =>
    ({
      runtimeId: 'runtime-1',
      localNodeId: 'node-1',
      command: {commandName, commandId: `command-${commandName}`, requestId: 'request-1', payload},
      actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
      getState,
      dispatchAction: (action: unknown) => {
        projectState = projectBasicReducer(projectState, action as never);
        return action as never;
      },
      dispatchCommand,
      flushPersistence: () => flushPersistence(),
      platformPorts: {
        logger: {scope: () => ({info: (entry: unknown) => logEntries.push(entry), error: () => undefined})},
      },
    }) as unknown as ActorExecutionContext;
  const applySlaveProjection = (entries: ReturnType<typeof getProjectBasicSyncEntries>): void => {
    instanceMode = 'SLAVE';
    clientState.activationStatus = 'inactive';
    storeState = {
      ...storeState,
      loadReadiness: Object.freeze({runtimeId: null, binding: null, storeStatus: 'idle'}),
    };
    const organization = entries.organization?.value;
    const rules = entries.rules?.value;
    if (organization === undefined || rules === undefined) throw new Error('master project projection is incomplete');
    projectState = Object.freeze({
      ...initialProjectBasicState,
      organizationPath: organization as ProjectBasicState['organizationPath'],
      ruleSnapshot: rules as ProjectBasicState['ruleSnapshot'],
      ruleSnapshotStatus: Object.freeze({status: 'ready', errorCode: null}),
    });
  };
  return {
    actor,
    calls,
    requestedTargets,
    logEntries,
    getState,
    makeContext,
    getProjectState: () => projectState,
    setCurrentTask: (task: TerminalUpdateTask | null) => {
      currentTask = task;
    },
    applySlaveProjection,
    setOrganizationReadFailure: (failed: boolean) => {
      failOrganizationRead = failed;
    },
    setOrganizationPathRead: (path: typeof organizationPath) => {
      organizationPathRead = path;
      organizationPathReader = null;
    },
    setOrganizationPathReader: (reader: () => Promise<typeof organizationPath>) => {
      organizationPathReader = reader;
    },
    failTopicSubscriptionFor: (ownerRef: string | null) => {
      failedSubscriptionOwnerRef = ownerRef;
    },
    setRuleSnapshotChanged: (changed: boolean) => {
      rejectRuleSnapshotReads = changed;
    },
    setAcceptOutcomeStatus: (status: string) => {
      acceptOutcomeStatus = status;
    },
    setUpdateRequestResult: (result: StateJsonValue) => {
      updateRequestResult = result;
    },
    setFlushPersistence: (flush: ActorExecutionContext['flushPersistence']) => {
      flushPersistence = flush;
    },
  };
};

describe('project-basic owner', () => {
  it('registers every exported selector in the runtime module', () => {
    const module = createProjectBasicModule();
    expect(module.selectorDefinitions).toEqual(
      expect.arrayContaining([
        selectCommercialGroup,
        selectProject,
        selectProjectBasicLoadReadiness,
        selectProjectBasicState,
        selectProjectBasicTopicState,
        selectProjectOrganizationPath,
        selectProjectTerminalUpdateCandidate,
        selectProjectTerminalUpdateContextFacts,
        selectProjectFixedTerminalUpdateContextFacts,
        selectProjectTerminalUpdateRules,
        selectRegion,
      ]),
    );
  });

  it('keeps the network profile independent from the business workspace when selecting an update candidate', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    if (load === undefined) throw new Error('store-basic handoff handler missing');

    await expect(
      load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)),
    ).resolves.toEqual({status: 'ready'});

    const state = harness.getState();
    expect(selectActivationState(state).status).toBe('active');
    expect(selectProjectTerminalUpdateRules(state)).toMatchObject({
      status: 'ready',
      projectRef,
      collectionHash: 'a'.repeat(64),
    });
    expect(
      selectTerminalTopicSubscriptions(state)
        .filter(item => item.subscriberKey === 'kernel.feature.project-basic')
        .map(item => [item.topicKey, item.ownerRef])
        .sort(),
    ).toEqual([
      ['COMMERCIAL_GROUP', commercialGroupRef],
      ['PROJECT', projectRef],
      ['REGION', regionRef],
      ['TERMINAL_UPDATE_RULES', projectRef],
    ]);
    const candidate = selectProjectTerminalUpdateCandidate(state, 'com.example.console', storeRef);
    expect(candidate).toMatchObject({
      collectionHash: 'a'.repeat(64),
      storeRef,
      rule: {ruleRef: ruleItem.ruleRef},
    });
    expect(selectProjectTerminalUpdateCandidate(state, 'com.example.wallpaper', storeRef)).toBeNull();
    if (candidate === null) throw new Error('expected current project terminal-update candidate');
    const target = fixedTargetFromProjectCandidate(candidate);
    expect(
      selectCurrentProjectTerminalUpdateTarget(
        state,
        target.applicationId,
        target.ruleRef,
        target.collectionHash,
        target.selectionContext.contextIdentity,
      ),
    ).toEqual(target);
    expect(
      selectCurrentProjectTerminalUpdateTarget(
        state,
        target.applicationId,
        target.ruleRef,
        'b'.repeat(64),
        target.selectionContext.contextIdentity,
      ),
    ).toBeNull();

    const evaluate = harness.actor.handlers.find(
      item => item.commandName === evaluateProjectTerminalUpdateCommand.commandName,
    );
    if (evaluate === undefined) throw new Error('project update evaluator missing');
    await expect(
      evaluate.handle(harness.makeContext(evaluateProjectTerminalUpdateCommand.commandName, {})),
    ).resolves.toEqual({status: 'no-update'});
    expect(harness.requestedTargets).toHaveLength(1);
    expect(harness.requestedTargets[0]).toMatchObject({
      ruleRef: ruleItem.ruleRef,
      collectionHash: 'a'.repeat(64),
      applicationId: 'com.example.console',
      policy: {nSeconds: 300, hotStrategy: null, mSeconds: null},
    });
    expect(
      harness.calls.find(
        call =>
          call.name === executeTerminalHttpCommand.commandName &&
          operationForPayload(call.payload) === 'terminalReadStoreOrganizationPath',
      ),
    ).toBeDefined();
  });

  it('signals the update owner to continue an existing fixed task without selecting a new rule', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const evaluate = harness.actor.handlers.find(
      item => item.commandName === evaluateProjectTerminalUpdateCommand.commandName,
    );
    if (load === undefined || evaluate === undefined) throw new Error('project-basic load/evaluate handler missing');

    await load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding));
    harness.setCurrentTask({taskId: 'fixed-task-1', phase: 'fixed', actionId: null} as TerminalUpdateTask);

    await expect(
      evaluate.handle(harness.makeContext(evaluateProjectTerminalUpdateCommand.commandName, {})),
    ).resolves.toEqual({status: 'no-update'});

    expect(harness.requestedTargets).toEqual([null]);
    expect(harness.calls.filter(call => call.name === requestTerminalUpdateCommand.commandName)).toHaveLength(1);
  });

  it('records a typed terminal-update rejection reason without logging target contents', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const evaluate = harness.actor.handlers.find(
      item => item.commandName === evaluateProjectTerminalUpdateCommand.commandName,
    );
    if (load === undefined || evaluate === undefined) throw new Error('project-basic load/evaluate handler missing');
    await load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding));
    harness.setUpdateRequestResult({status: 'rejected', reason: 'TARGET_CHANGED'});

    await expect(
      evaluate.handle(harness.makeContext(evaluateProjectTerminalUpdateCommand.commandName, {})),
    ).resolves.toMatchObject({status: 'rejected', reason: 'TARGET_CHANGED'});

    const requested = harness.logEntries
      .map(entry => entry as {event?: string; data?: Record<string, unknown>})
      .find(entry => entry.event === 'terminal-update-requested');
    expect(requested?.data).toMatchObject({resultStatus: 'rejected', reasonCode: 'TARGET_CHANGED'});
    expect(JSON.stringify(requested)).not.toContain('com.example.console');
  });

  it('keeps rule candidates unavailable until the new snapshot is flushed and never restores old eligibility on flush failure', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const refresh = harness.actor.handlers.find(
      item => item.commandName === refreshProjectTerminalUpdateRulesCommand.commandName,
    );
    if (load === undefined || refresh === undefined) throw new Error('project-basic load/refresh handler missing');
    await load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding));
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', storeRef)).not.toBeNull();

    let releaseFlush!: (result: Awaited<ReturnType<ActorExecutionContext['flushPersistence']>>) => void;
    let markFlushStarted!: () => void;
    const flushStarted = new Promise<void>(resolve => {
      markFlushStarted = resolve;
    });
    const flushGate = new Promise<Awaited<ReturnType<ActorExecutionContext['flushPersistence']>>>(resolve => {
      releaseFlush = resolve;
    });
    harness.setFlushPersistence(async () => {
      markFlushStarted();
      return flushGate;
    });

    const refreshing = refresh.handle(harness.makeContext(refreshProjectTerminalUpdateRulesCommand.commandName, {}));
    await flushStarted;
    expect(harness.getProjectState().ruleSnapshotStatus.status).toBe('loading');
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', storeRef)).toBeNull();
    releaseFlush(successfulPersistenceResult());
    await expect(refreshing).resolves.toMatchObject({status: 'ready'});
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', storeRef)).not.toBeNull();

    harness.setFlushPersistence(async () => successfulPersistenceResult());
    await refresh.handle(harness.makeContext(refreshProjectTerminalUpdateRulesCommand.commandName, {}));
    harness.setFlushPersistence(async () => failedPersistenceResult());
    await expect(
      refresh.handle(harness.makeContext(refreshProjectTerminalUpdateRulesCommand.commandName, {})),
    ).resolves.toMatchObject({status: 'persistence-failed'});
    expect(harness.getProjectState().ruleSnapshotStatus.status).toBe('failed');
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', storeRef)).toBeNull();
  });

  it('tombstones retained organization and rules while an authoritative organization refresh is unavailable, then restores the projection', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const refresh = harness.actor.handlers.find(
      item => item.commandName === refreshProjectBasicTopicCommand.commandName,
    );
    if (load === undefined || refresh === undefined) throw new Error('project-basic load/refresh handler missing');
    await expect(
      load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)),
    ).resolves.toEqual({status: 'ready'});

    const notification = (notificationId: string) =>
      Object.freeze({
        notificationId,
        subscriptionId: 'subscription-1',
        topicKey: 'PROJECT' as const,
        ownerRef: projectRef,
        topicTimeEpochMillis: 202,
      });
    const originalOrganization = harness.getProjectState().organizationPath;
    const originalRules = harness.getProjectState().ruleSnapshot;
    harness.setOrganizationReadFailure(true);

    await expect(
      refresh.handle(
        harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
          binding,
          notification: notification('notification-failed'),
        }),
      ),
    ).resolves.toMatchObject({status: 'organization-read-failed', reason: 'ORGANIZATION_PATH_UNAVAILABLE'});

    expect(harness.getProjectState().organizationPath).toEqual(originalOrganization);
    expect(harness.getProjectState().ruleSnapshot).toEqual(originalRules);
    expect(getProjectBasicSyncEntries(harness.getProjectState())).toMatchObject({
      organization: {tombstone: true},
      rules: {tombstone: true},
    });
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', storeRef)).toBeNull();

    harness.setOrganizationReadFailure(false);
    await expect(
      refresh.handle(
        harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
          binding,
          notification: notification('notification-recovered'),
        }),
      ),
    ).resolves.toEqual({status: 'refreshed'});
    expect(getProjectBasicSyncEntries(harness.getProjectState())).toMatchObject({
      organization: {value: originalOrganization},
      rules: {value: originalRules},
    });
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', storeRef)).toMatchObject({
      rule: {ruleRef: ruleItem.ruleRef},
    });
  });

  it('does not report a refreshed topic when the notification child result was not accepted', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const refresh = harness.actor.handlers.find(
      item => item.commandName === refreshProjectBasicTopicCommand.commandName,
    );
    if (load === undefined || refresh === undefined) throw new Error('project-basic load/refresh handler missing');
    await expect(
      load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)),
    ).resolves.toEqual({status: 'ready'});
    harness.setAcceptOutcomeStatus('stale-notification');

    await expect(
      refresh.handle(
        harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
          binding,
          notification: Object.freeze({
            notificationId: 'notification-stale',
            subscriptionId: 'subscription-1',
            topicKey: 'TERMINAL_UPDATE_RULES',
            ownerRef: projectRef,
            topicTimeEpochMillis: 202,
          }),
        }),
      ),
    ).resolves.toEqual({status: 'accept-failed'});

    expect(selectProjectBasicTopicState(harness.getState(), 'TERMINAL_UPDATE_RULES')).toEqual({
      status: 'failed',
      errorCode: 'TOPIC_ACCEPT_FAILED',
    });
  });

  it('keeps an older organization topic read from overwriting a newer path read', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const refresh = harness.actor.handlers.find(
      item => item.commandName === refreshProjectBasicTopicCommand.commandName,
    );
    if (load === undefined || refresh === undefined) throw new Error('project-basic load/refresh handler missing');
    await load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding));

    let releaseOlder!: (path: typeof organizationPath) => void;
    let releaseNewer!: (path: typeof organizationPath) => void;
    let olderStarted!: () => void;
    let newerStarted!: () => void;
    const olderStartedPromise = new Promise<void>(resolve => {
      olderStarted = resolve;
    });
    const newerStartedPromise = new Promise<void>(resolve => {
      newerStarted = resolve;
    });
    const olderRead = new Promise<typeof organizationPath>(resolve => {
      releaseOlder = resolve;
    });
    const newerRead = new Promise<typeof organizationPath>(resolve => {
      releaseNewer = resolve;
    });
    let readIndex = 0;
    harness.setOrganizationPathReader(() => {
      const index = readIndex++;
      if (index === 0) {
        olderStarted();
        return olderRead;
      }
      newerStarted();
      return newerRead;
    });

    const olderRefresh = refresh.handle(
      harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
        binding,
        notification: Object.freeze({
          notificationId: 'notification-project-old',
          subscriptionId: 'subscription-project',
          topicKey: 'PROJECT',
          ownerRef: projectRef,
          topicTimeEpochMillis: 202,
        }),
      }),
    );
    await olderStartedPromise;
    const newerRefresh = refresh.handle(
      harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
        binding,
        notification: Object.freeze({
          notificationId: 'notification-region-new',
          subscriptionId: 'subscription-region',
          topicKey: 'REGION',
          ownerRef: regionRef,
          topicTimeEpochMillis: 203,
        }),
      }),
    );
    await newerStartedPromise;
    const latestPath = Object.freeze({
      ...organizationPath,
      regionRef: '00000000-0000-4000-8000-000000000021',
      regionName: 'New Region',
    });
    releaseNewer(latestPath);
    await expect(newerRefresh).resolves.toEqual({status: 'refreshed'});
    releaseOlder(
      Object.freeze({...organizationPath, regionRef: '00000000-0000-4000-8000-000000000022', regionName: 'Old Region'}),
    );
    await expect(olderRefresh).resolves.toEqual({status: 'stale-result'});

    expect(selectProjectOrganizationPath(harness.getState())).toMatchObject({value: latestPath});
    const acceptedNotifications = harness.calls
      .filter(call => call.name.endsWith('.accept-topic-notification'))
      .map(call => (call.payload as {notificationId: string}).notificationId);
    expect(acceptedNotifications).toEqual(['notification-region-new']);
  });

  it('does not accept an organization notification when required rule refresh persistence fails', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const refresh = harness.actor.handlers.find(
      item => item.commandName === refreshProjectBasicTopicCommand.commandName,
    );
    if (load === undefined || refresh === undefined) throw new Error('project-basic load/refresh handler missing');
    await load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding));
    harness.setOrganizationPathRead(Object.freeze({...organizationPath, projectUpdatedAtEpochMillis: 102}));
    let flushCount = 0;
    harness.setFlushPersistence(async () => {
      flushCount += 1;
      return flushCount === 1 ? successfulPersistenceResult() : failedPersistenceResult();
    });

    await expect(
      refresh.handle(
        harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
          binding,
          notification: Object.freeze({
            notificationId: 'notification-project-flush-failed',
            subscriptionId: 'subscription-project',
            topicKey: 'PROJECT',
            ownerRef: projectRef,
            topicTimeEpochMillis: 202,
          }),
        }),
      ),
    ).resolves.toMatchObject({status: 'persistence-failed'});

    expect(harness.calls.some(call => call.name.endsWith('.accept-topic-notification'))).toBe(false);
    expect(selectProjectBasicTopicState(harness.getState(), 'TERMINAL_UPDATE_RULES')).toMatchObject({
      status: 'failed',
      errorCode: 'RULE_SNAPSHOT_FLUSH_FAILED',
    });
  });

  it('does not accept an organization notification when its required topic subscription fails', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const refresh = harness.actor.handlers.find(
      item => item.commandName === refreshProjectBasicTopicCommand.commandName,
    );
    if (load === undefined || refresh === undefined) throw new Error('project-basic load/refresh handler missing');
    await load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding));
    const nextRegionRef = '00000000-0000-4000-8000-000000000021';
    harness.setOrganizationPathRead(Object.freeze({...organizationPath, regionRef: nextRegionRef}));
    harness.failTopicSubscriptionFor(nextRegionRef);

    await expect(
      refresh.handle(
        harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
          binding,
          notification: Object.freeze({
            notificationId: 'notification-project-subscribe-failed',
            subscriptionId: 'subscription-project',
            topicKey: 'PROJECT',
            ownerRef: projectRef,
            topicTimeEpochMillis: 202,
          }),
        }),
      ),
    ).resolves.toMatchObject({status: 'organization-subscribe-failed'});

    expect(harness.calls.some(call => call.name.endsWith('.accept-topic-notification'))).toBe(false);
    expect(selectProjectBasicTopicState(harness.getState(), 'REGION')).toMatchObject({
      status: 'failed',
      errorCode: 'TOPIC_SUBSCRIPTION_FAILED',
    });
  });

  it('exposes exhausted snapshot-change retries as a failed rule state and topic', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const refreshRules = harness.actor.handlers.find(
      item => item.commandName === refreshProjectTerminalUpdateRulesCommand.commandName,
    );
    if (load === undefined || refreshRules === undefined)
      throw new Error('project-basic load/rule refresh handler missing');
    await expect(
      load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)),
    ).resolves.toEqual({status: 'ready'});
    const snapshotReadsBefore = harness.calls.filter(
      call =>
        call.name === executeTerminalHttpCommand.commandName &&
        operationForPayload(call.payload) === 'terminalReadProjectUpdateRuleSnapshotPage',
    ).length;
    harness.setRuleSnapshotChanged(true);

    await expect(
      refreshRules.handle(harness.makeContext(refreshProjectTerminalUpdateRulesCommand.commandName, {})),
    ).resolves.toEqual({status: 'failed', reason: 'SNAPSHOT_COLLECTION_CHANGED'});

    const snapshotReadsAfter = harness.calls.filter(
      call =>
        call.name === executeTerminalHttpCommand.commandName &&
        operationForPayload(call.payload) === 'terminalReadProjectUpdateRuleSnapshotPage',
    ).length;
    expect(snapshotReadsAfter - snapshotReadsBefore).toBe(3);
    expect(selectProjectTerminalUpdateRules(harness.getState())).toMatchObject({
      status: 'failed',
      errorCode: 'SNAPSHOT_COLLECTION_CHANGED',
    });
    expect(selectProjectBasicTopicState(harness.getState(), 'TERMINAL_UPDATE_RULES')).toEqual({
      status: 'failed',
      errorCode: 'SNAPSHOT_COLLECTION_CHANGED',
    });
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', storeRef)).toBeNull();
  });

  it('starts local updates from current SLAVE project projections without master activation or remote reads', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(
      item => item.commandName === storeBasicInformationLoadedCommand.commandName,
    );
    const evaluate = harness.actor.handlers.find(
      item => item.commandName === evaluateProjectTerminalUpdateCommand.commandName,
    );
    if (load === undefined || evaluate === undefined) throw new Error('project-basic handlers missing');
    await expect(
      load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)),
    ).resolves.toEqual({status: 'ready'});

    harness.applySlaveProjection(getProjectBasicSyncEntries(harness.getProjectState()));
    const state = harness.getState();
    expect(selectProjectTerminalUpdateContextFacts(state)).toEqual({
      terminalRef: binding.terminalRef,
      bindingGeneration: binding.bindingGeneration,
      selectedSpace: binding.groupWorkspaceKey,
      storeRef: binding.storeRef,
      projectRef,
      projectUpdatedAtEpochMillis: organizationPath.projectUpdatedAtEpochMillis,
    });
    expect(selectProjectTerminalUpdateCandidate(state, 'com.example.console', storeRef)).toMatchObject({
      rule: {ruleRef: ruleItem.ruleRef},
    });

    const topology = state[topologySliceName] as Record<string, unknown>;
    const offlineState = {
      ...state,
      [topologySliceName]: {
        ...topology,
        peerReachable: false,
        peerStateSyncConnectionId: null,
        peerAppliedStateSyncRevisions: {},
      },
    } as StateRoot;
    expect(selectProjectTerminalUpdateContextFacts(offlineState)).toBeNull();
    expect(selectProjectFixedTerminalUpdateContextFacts(offlineState)).toEqual(
      selectProjectFixedTerminalUpdateContextFacts(state),
    );
    expect(selectProjectFixedTerminalUpdateContextFacts(offlineState)).not.toBeNull();

    const unpairedState = {
      ...offlineState,
      [topologySliceName]: {...topology, peerIdentity: null, peerReachable: false, peerStateSyncConnectionId: null},
    } as StateRoot;
    expect(selectProjectFixedTerminalUpdateContextFacts(unpairedState)).toBeNull();

    const client = state['kernel.base.terminal-data-client.client'] as {
      credential: Record<string, unknown>;
    };
    const changedCredentialState = {
      ...offlineState,
      'kernel.base.terminal-data-client.client': {
        ...state['kernel.base.terminal-data-client.client'],
        credential: {...client.credential, bindingGeneration: binding.bindingGeneration + 1},
      },
    } as StateRoot;
    expect(selectProjectFixedTerminalUpdateContextFacts(changedCredentialState)).toBeNull();

    const readCountBeforeEvaluation = harness.calls.filter(
      call => call.name === executeTerminalHttpCommand.commandName,
    ).length;
    await expect(
      evaluate.handle(harness.makeContext(evaluateProjectTerminalUpdateCommand.commandName, {})),
    ).resolves.toEqual({status: 'no-update'});
    expect(harness.requestedTargets).toHaveLength(1);
    expect(harness.calls.filter(call => call.name === executeTerminalHttpCommand.commandName)).toHaveLength(
      readCountBeforeEvaluation,
    );

    const dispatched: string[] = [];
    const module = createProjectBasicModule();
    await module.install?.({
      runtimeId: 'runtime-1',
      getState: harness.getState,
      dispatchCommand: async (command: {commandName: string}) => {
        dispatched.push(command.commandName);
        return {status: 'completed', actorResults: []};
      },
      subscribeState: () => () => undefined,
      registerResource: () => undefined,
      platformPorts: {logger: {error: () => undefined}},
    } as never);
    expect(dispatched).toContain(evaluateProjectTerminalUpdateCommand.commandName);
  });
});
