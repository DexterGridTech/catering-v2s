import {describe, expect, it} from 'vitest';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {
  readTerminalDataCommand,
  selectActivationState,
  selectTerminalTopicSubscriptions,
  type TerminalTopicSubscription,
  type TerminalTopicKey,
  type TerminalReadOperationId,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  requestTerminalUpdateCommand,
} from '@catering-v2s/kernel-base-terminal-update';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {topologySliceName} from '@catering-v2s/kernel-base-topology';
import {storeBasicInformationLoadedCommand, storeBasicSliceName, type StoreBasicBinding, type StoreBasicState} from '@catering-v2s/kernel-feature-store-basic';
import {selectProjectTerminalUpdateContextFacts, selectProjectTerminalUpdateCandidate, selectProjectTerminalUpdateRules} from '../src/selectors/selectors';
import {createProjectBasicActors} from '../src/features/actors/actors';
import {evaluateProjectTerminalUpdateCommand} from '../src/features/commands/commands';
import {getProjectBasicSyncEntries, initialProjectBasicState, projectBasicReducer, projectBasicSliceName} from '../src/features/slices/slice';
import {refreshProjectBasicTopicCommand} from '../src/features/commands/commands';
import {createProjectBasicModule} from '../src/application/module';
import type {ProjectBasicState} from '../src/types/types';

const binding: StoreBasicBinding = Object.freeze({
  terminalRef: 'terminal-1', storeRef: 'store-1', groupWorkspaceKey: 'workspace-1', bindingGeneration: 7,
});
const organizationPath = Object.freeze({
  projectRef: 'project-1', projectName: 'Project', regionRef: 'region-1', regionName: 'Region',
  commercialGroupRef: 'group-1', commercialGroupName: 'Group', projectUpdatedAtEpochMillis: 101,
  regionUpdatedAtEpochMillis: 102, commercialGroupUpdatedAtEpochMillis: 103,
});
const artifact = (kind: 'FULL' | 'HOT') => Object.freeze({
  artifactRef: `artifact-${kind.toLowerCase()}`, kind, applicationId: 'com.example.console', runtimeVersion: '1.0.0',
  nativeBuildNumber: 3, apkVersion: '3.0.0', jsVersion: '3.0.0', publicationId: 'b'.repeat(64),
  apkSha256: kind === 'FULL' ? 'c'.repeat(64) : null, zipSha256: 'd'.repeat(64), byteSize: 128,
  createdAtEpochMillis: 201,
});
const ruleItem = Object.freeze({
  ruleRef: '10000000-0000-4000-8000-000000000007', targetMode: 'STORE_REFS', storeRefs: ['store-1'],
  applicationId: 'com.example.console', createdAtEpochMillis: 201, full: artifact('FULL'), hot: null,
  nSeconds: 300, hotStrategy: null, mSeconds: null, description: null,
});
const snapshotPage = Object.freeze({items: [ruleItem], collectionHash: 'a'.repeat(64), nextCursor: null});

const createHarness = () => {
  const actor = createProjectBasicActors()[0];
  if (actor === undefined) throw new Error('project-basic actor missing');
  let projectState = projectBasicReducer(undefined, {type: 'test/init'});
  let instanceMode: 'MASTER' | 'SLAVE' = 'MASTER';
  let storeState = {
    binding,
    loadReadiness: Object.freeze({runtimeId: 'runtime-1', binding, storeStatus: 'flushed'}),
    store: Object.freeze({value: Object.freeze({id: 'store-1', groupWorkspaceKey: 'workspace-1', project: {id: 'project-1'}}), updatedAtEpochMillis: 100}),
  } as unknown as StoreBasicState;
  const clientState = {
    credential: {...binding, deviceId: 'device-1', credentialSecret: 'secret'}, activationStatus: 'active',
    connection: {status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null}, pendingActivations: {},
    heartbeatIntervalMs: null, nextPingSequence: 1, lastRttMs: 0, latencySamples: [],
    topicSubscriptions: {} as Record<string, TerminalTopicSubscription>, acceptedTopicTimes: {},
  };
  const updateState = {
    currentTask: null,
    actualVersions: {applicationId: 'com.example.console', nativeVersion: '2.0.0', nativeBuildNumber: 2,
      runtimeVersion: '1.0.0', bundleVersion: '2.0.0', publicationId: 'a'.repeat(64), bootId: 'boot-1', entryKind: 'embedded'},
  };
  let subscriptionSequence = 0;
  let failOrganizationRead = false;
  const calls: Array<Readonly<{name: string; payload: unknown}>> = [];
  const requestedTargets: unknown[] = [];
  const getState = (): StateRoot => ({
    'kernel.base.runtime.instance-mode': {instanceMode},
    'kernel.base.terminal-data-client.client': clientState,
    'kernel.base.terminal-update.state': updateState,
    [serverConfigSliceName]: {selectedSpace: 'workspace-1'},
    [topologySliceName]: {
      peerReachable: instanceMode === 'SLAVE',
      peerIdentity: instanceMode === 'SLAVE' ? {moduleName: 'sample-console', instanceMode: 'MASTER'} : null,
      peerStateSyncConnectionId: instanceMode === 'SLAVE' ? 'peer-connection-1' : null,
      peerAppliedStateSyncRevisions: instanceMode === 'SLAVE'
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
    if (definition.commandName === readTerminalDataCommand.commandName) {
      const operationId = (payload as {operationId: TerminalReadOperationId}).operationId;
      if (operationId === 'terminalReadStoreOrganizationPath' && failOrganizationRead)
        return success({kind: 'business-rejection', errorCode: 'ORGANIZATION_PATH_UNAVAILABLE'});
      const body = operationId === 'terminalReadStoreOrganizationPath' ? organizationPath
        : operationId === 'terminalReadProjectUpdateRuleSnapshotPage' ? snapshotPage : null;
      return body === null ? success({kind: 'failure', category: 'not-delivered', code: 'UNEXPECTED_READ'})
        : success({kind: 'success', status: 200, body: body as unknown as StateJsonValue});
    }
    if (definition.commandName === requestTerminalUpdateCommand.commandName) {
      requestedTargets.push((payload as {target: unknown}).target);
      return success({status: 'no-update'});
    }
    if (definition.commandName.endsWith('.subscribe-topic')) {
      const request = payload as {subscriberKey: string; topicKey: string; ownerRef: string; initialTimeEpochMillis: number};
      const subscriptionId = `subscription-${++subscriptionSequence}`;
      clientState.topicSubscriptions[subscriptionId] = {
        subscriptionId, identityKey: `${request.subscriberKey}:${request.topicKey}:${request.ownerRef}`,
        subscriberKey: request.subscriberKey, topicKey: request.topicKey as TerminalTopicKey, ownerRef: request.ownerRef,
        acceptedTimeEpochMillis: request.initialTimeEpochMillis, pendingNotification: null,
      };
      return success({status: 'subscribed'});
    }
    if (definition.commandName.endsWith('.unsubscribe-topic')) return success({status: 'not-subscribed'});
    if (definition.commandName.endsWith('.accept-topic-notification')) return success({status: 'accepted'});
    return {status: 'completed', actorResults: []};
  };
  const makeContext = (commandName: string, payload: unknown): ActorExecutionContext => ({
    runtimeId: 'runtime-1', localNodeId: 'node-1',
    command: {commandName, commandId: `command-${commandName}`, requestId: 'request-1', payload},
    actor: {actorKey: actor.actorKey, moduleName: actor.moduleName, actorName: actor.actorName},
    getState,
    dispatchAction: (action: unknown) => {
      projectState = projectBasicReducer(projectState, action as never);
      return action as never;
    },
    dispatchCommand,
    flushPersistence: async () => ({status: 'succeeded'}),
    platformPorts: {logger: {scope: () => ({info: () => undefined, error: () => undefined})}},
  } as unknown as ActorExecutionContext);
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
  return {actor, calls, requestedTargets, getState, makeContext, getProjectState: () => projectState,
    applySlaveProjection,
    setOrganizationReadFailure: (failed: boolean) => { failOrganizationRead = failed; }};
};

describe('project-basic owner', () => {
  it('loads project facts after the store-ready command and submits only the selected app candidate to update', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(item => item.commandName === storeBasicInformationLoadedCommand.commandName);
    if (load === undefined) throw new Error('store-basic handoff handler missing');

    await expect(load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)))
      .resolves.toEqual({status: 'ready'});

    const state = harness.getState();
    expect(selectActivationState(state).status).toBe('active');
    expect(selectProjectTerminalUpdateRules(state)).toMatchObject({status: 'ready', projectRef: 'project-1', collectionHash: 'a'.repeat(64)});
    expect(selectTerminalTopicSubscriptions(state).filter(item => item.subscriberKey === 'kernel.feature.project-basic')
      .map(item => [item.topicKey, item.ownerRef]).sort()).toEqual([
      ['COMMERCIAL_GROUP', 'group-1'], ['PROJECT', 'project-1'], ['REGION', 'region-1'], ['TERMINAL_UPDATE_RULES', 'project-1'],
    ]);
    const candidate = selectProjectTerminalUpdateCandidate(state, 'com.example.console', 'store-1');
    expect(candidate).toMatchObject({collectionHash: 'a'.repeat(64), storeRef: 'store-1', rule: {ruleRef: ruleItem.ruleRef}});
    expect(selectProjectTerminalUpdateCandidate(state, 'com.example.wallpaper', 'store-1')).toBeNull();

    const evaluate = harness.actor.handlers.find(item => item.commandName === evaluateProjectTerminalUpdateCommand.commandName);
    if (evaluate === undefined) throw new Error('project update evaluator missing');
    await expect(evaluate.handle(harness.makeContext(evaluateProjectTerminalUpdateCommand.commandName, {})))
      .resolves.toEqual({status: 'no-update'});
    expect(harness.requestedTargets).toHaveLength(1);
    expect(harness.requestedTargets[0]).toMatchObject({
      ruleRef: ruleItem.ruleRef, collectionHash: 'a'.repeat(64), applicationId: 'com.example.console',
      policy: {nSeconds: 300, hotStrategy: null, mSeconds: null},
    });
    expect(harness.calls.find(call => call.name === readTerminalDataCommand.commandName &&
      (call.payload as {operationId?: string}).operationId === 'terminalReadStoreOrganizationPath')).toBeDefined();
  });

  it('tombstones retained organization and rules while an authoritative organization refresh is unavailable, then restores the projection', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(item => item.commandName === storeBasicInformationLoadedCommand.commandName);
    const refresh = harness.actor.handlers.find(item => item.commandName === refreshProjectBasicTopicCommand.commandName);
    if (load === undefined || refresh === undefined) throw new Error('project-basic load/refresh handler missing');
    await expect(load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)))
      .resolves.toEqual({status: 'ready'});

    const notification = (notificationId: string) => Object.freeze({
      notificationId, subscriptionId: 'subscription-1', topicKey: 'PROJECT' as const,
      ownerRef: 'project-1', topicTimeEpochMillis: 202,
    });
    const originalOrganization = harness.getProjectState().organizationPath;
    const originalRules = harness.getProjectState().ruleSnapshot;
    harness.setOrganizationReadFailure(true);

    await expect(refresh.handle(harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
      binding, notification: notification('notification-failed'),
    }))).resolves.toMatchObject({status: 'organization-read-failed', reason: 'ORGANIZATION_PATH_UNAVAILABLE'});

    expect(harness.getProjectState().organizationPath).toEqual(originalOrganization);
    expect(harness.getProjectState().ruleSnapshot).toEqual(originalRules);
    expect(getProjectBasicSyncEntries(harness.getProjectState())).toMatchObject({
      organization: {tombstone: true},
      rules: {tombstone: true},
    });
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', 'store-1')).toBeNull();

    harness.setOrganizationReadFailure(false);
    await expect(refresh.handle(harness.makeContext(refreshProjectBasicTopicCommand.commandName, {
      binding, notification: notification('notification-recovered'),
    }))).resolves.toEqual({status: 'refreshed'});
    expect(getProjectBasicSyncEntries(harness.getProjectState())).toMatchObject({
      organization: {value: originalOrganization},
      rules: {value: originalRules},
    });
    expect(selectProjectTerminalUpdateCandidate(harness.getState(), 'com.example.console', 'store-1'))
      .toMatchObject({rule: {ruleRef: ruleItem.ruleRef}});
  });

  it('starts local updates from current SLAVE project projections without master activation or remote reads', async () => {
    const harness = createHarness();
    const load = harness.actor.handlers.find(item => item.commandName === storeBasicInformationLoadedCommand.commandName);
    const evaluate = harness.actor.handlers.find(item => item.commandName === evaluateProjectTerminalUpdateCommand.commandName);
    if (load === undefined || evaluate === undefined) throw new Error('project-basic handlers missing');
    await expect(load.handle(harness.makeContext(storeBasicInformationLoadedCommand.commandName, binding)))
      .resolves.toEqual({status: 'ready'});

    harness.applySlaveProjection(getProjectBasicSyncEntries(harness.getProjectState()));
    const state = harness.getState();
    expect(selectProjectTerminalUpdateContextFacts(state)).toEqual({
      terminalRef: binding.terminalRef,
      bindingGeneration: binding.bindingGeneration,
      selectedSpace: binding.groupWorkspaceKey,
      storeRef: binding.storeRef,
      projectRef: 'project-1',
      projectUpdatedAtEpochMillis: organizationPath.projectUpdatedAtEpochMillis,
    });
    expect(selectProjectTerminalUpdateCandidate(state, 'com.example.console', 'store-1'))
      .toMatchObject({rule: {ruleRef: ruleItem.ruleRef}});

    const readCountBeforeEvaluation = harness.calls.filter(call => call.name === readTerminalDataCommand.commandName).length;
    await expect(evaluate.handle(harness.makeContext(evaluateProjectTerminalUpdateCommand.commandName, {})))
      .resolves.toEqual({status: 'no-update'});
    expect(harness.requestedTargets).toHaveLength(1);
    expect(harness.calls.filter(call => call.name === readTerminalDataCommand.commandName)).toHaveLength(readCountBeforeEvaluation);

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
