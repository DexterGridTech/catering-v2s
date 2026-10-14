import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {TerminalActivationSucceededPayload, TerminalTopicKey} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  selectStore,
  type StoreBasicBinding,
} from '@catering-v2s/kernel-feature-store-basic';
import type {
  TerminalOperationResult,
  TerminalStoreOrganizationPathRead,
} from '../../../generated/terminalApi';
import {organizationTopicKeys} from '../../../declarations/topics';
import type {ProjectBasicState} from '../../../types/types';
import {
  reconcileProjectTopicSubscriptions,
} from './reconcileProjectTopicSubscriptions';
import type {
  ProjectOwnerReadOperationId,
  ProjectOwnerReadPayload,
} from './refreshProjectRuleSnapshot';

type OrganizationLog = (
  context: ActorExecutionContext,
  input: Readonly<{
    event: string;
    data: Readonly<Record<string, string | number | boolean | null>>;
    requestId?: ActorExecutionContext['command']['requestId'];
  }>,
) => void;

export type LoadProjectContextDependencies = Readonly<{
  readonly activeLoads: Set<string>;
  readonly completedLoads: Set<string>;
  readonly currentBinding: (context: ActorExecutionContext) => StoreBasicBinding | null;
  readonly sameBinding: (left: StoreBasicBinding | null, right: StoreBasicBinding | null) => boolean;
  readonly currentStoreIsReady: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
  readonly isCurrentMasterBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
  readonly bindingKey: (binding: StoreBasicBinding) => string;
  readonly readState: (context: ActorExecutionContext) => ProjectBasicState;
  readonly beginOrganizationRead: (context: ActorExecutionContext, binding: StoreBasicBinding) => () => boolean;
  readonly log: OrganizationLog;
  readonly setBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => void;
  readonly flush: (context: ActorExecutionContext) => Promise<void>;
  readonly setReadiness: (
    context: ActorExecutionContext,
    input: Readonly<{
      binding: StoreBasicBinding;
      status: ProjectBasicState['loadReadiness']['status'];
      projectRef: string | null;
    }>,
  ) => void;
  readonly setTopic: (
    context: ActorExecutionContext,
    input: Readonly<{
      topicKey: keyof ProjectBasicState['readStates'];
      status: 'idle' | 'loading' | 'loaded' | 'failed';
      errorCode?: string | null;
    }>,
  ) => void;
  readonly readOperation: (
    context: ActorExecutionContext,
    request: ProjectOwnerReadPayload,
  ) => Promise<TerminalOperationResult<ProjectOwnerReadOperationId> | null>;
  readonly markOrganizationFailed: (context: ActorExecutionContext, binding: StoreBasicBinding, reason: string) => void;
  readonly applyOrganizationPath: (
    context: ActorExecutionContext,
    path: TerminalStoreOrganizationPathRead,
    previousPath: TerminalStoreOrganizationPathRead | null,
  ) => void;
  readonly validPathForStore: (path: TerminalStoreOrganizationPathRead, storeProjectRef: string) => boolean;
  readonly subscribe: (
    context: ActorExecutionContext,
    input: Readonly<{topicKey: TerminalTopicKey; ownerRef: string; initialTimeEpochMillis: number}>,
  ) => Promise<boolean>;
  readonly unsubscribe: (
    context: ActorExecutionContext,
    topicKey: TerminalTopicKey,
    ownerRef: string,
  ) => Promise<boolean>;
  readonly refreshRules: (
    context: ActorExecutionContext,
    binding: StoreBasicBinding,
    path: TerminalStoreOrganizationPathRead,
  ) => Promise<Readonly<{status: string; reason?: string}>>;
}>;

export const createLoadProjectContext = (dependencies: LoadProjectContextDependencies) => {
  const {
    activeLoads,
    completedLoads,
    currentBinding,
    sameBinding,
    currentStoreIsReady,
    isCurrentMasterBinding,
    bindingKey,
    readState,
    beginOrganizationRead,
    log,
    setBinding,
    flush,
    setReadiness,
    setTopic,
    readOperation,
    markOrganizationFailed,
    applyOrganizationPath,
    validPathForStore,
    subscribe,
    unsubscribe,
    refreshRules,
  } = dependencies;

  return async (
    context: ActorExecutionContext,
    requestedBinding: TerminalActivationSucceededPayload,
  ): Promise<StateJsonValue> => {
    const binding = currentBinding(context);
    if (
      binding === null ||
      !sameBinding(binding, requestedBinding) ||
      !currentStoreIsReady(context, binding) ||
      !isCurrentMasterBinding(context, binding)
    )
      return {status: 'store-prerequisite-missing'};
    const loadStartedAt = Date.now();
    log(context, {event: 'organization-load-started', data: {projectBasicReady: false}});
    const key = bindingKey(binding);
    const currentState = readState(context);
    if (
      completedLoads.has(key) &&
      currentState.loadReadiness.runtimeId === context.runtimeId &&
      sameBinding(currentState.loadReadiness.binding, binding)
    )
      return {status: 'already-loaded'};
    if (activeLoads.has(key)) return {status: 'already-loading'};
    activeLoads.add(key);
    const isCurrentOrganizationRead = beginOrganizationRead(context, binding);
    try {
      const current = readState(context);
      if (!sameBinding(current.binding, binding)) {
        setBinding(context, binding);
        try {
          await flush(context);
        } catch {
          return {status: 'persistence-failed'};
        }
        if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      }
      setReadiness(context, {binding, status: 'loading', projectRef: null});
      for (const topicKey of organizationTopicKeys) setTopic(context, {topicKey, status: 'loading'});
      const result = await readOperation(context, {
        operationId: 'terminalReadStoreOrganizationPath',
        pathParameters: {storeRef: binding.storeRef},
      });
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      if (result?.kind !== 'success') {
        const reason =
          result?.kind === 'business-rejection'
            ? result.errorCode
            : result?.kind === 'failure'
              ? result.code
              : 'ORGANIZATION_PATH_READ_FAILED';
        markOrganizationFailed(context, binding, reason);
        return {status: 'organization-read-failed', reason};
      }
      const path = result.body as TerminalStoreOrganizationPathRead;
      const store = selectStore(context.getState());
      if (store === null || !validPathForStore(path, store.value.project.id)) {
        markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_MISMATCH');
        return {status: 'organization-path-mismatch'};
      }
      const previousPath = readState(context).organizationPath?.value;
      applyOrganizationPath(context, path, previousPath ?? null);
      try {
        await flush(context);
      } catch {
        markOrganizationFailed(context, binding, 'ORGANIZATION_PATH_FLUSH_FAILED');
        return {status: 'persistence-failed'};
      }
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      setReadiness(context, {binding, status: 'flushed', projectRef: path.projectRef});
      const orgSubscriptionsReady = await reconcileProjectTopicSubscriptions({
        context,
        path,
        isCurrent: isCurrentOrganizationRead,
        subscribe,
        unsubscribe,
      });
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      if (!orgSubscriptionsReady) return {status: 'organization-subscribe-failed'};
      const refreshed = await refreshRules(context, binding, path);
      if (!isCurrentOrganizationRead()) return {status: 'stale-result'};
      if (refreshed.status === 'ready') completedLoads.add(key);
      log(context, {
        event: 'organization-load-complete',
        data: {
          status: refreshed.status,
          projectRefMatchesStore: path.projectRef === store.value.project.id,
          projectChanged: previousPath?.projectRef !== path.projectRef,
          elapsedMs: Math.max(0, Date.now() - loadStartedAt),
        },
      });
      return refreshed;
    } finally {
      activeLoads.delete(key);
    }
  };
};
