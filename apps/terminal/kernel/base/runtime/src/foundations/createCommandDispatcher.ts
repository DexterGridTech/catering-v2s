import {
  createAppError,
  createCommandId,
  nowTimestampMs,
  type AppError,
  type CommandId,
} from '@catering-v2s/kernel-base-contracts';
import type {LoggerPort, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import type {StateJsonValue, StateRuntime} from '@catering-v2s/kernel-base-state';
import type {RegisteredActorHandler} from '../types/actor';
import type {
  ActorDispatchOptions,
  CommandDefinition,
  CommandDispatchOptions,
  DispatchedCommand,
} from '../types/command';
import type {ActorExecutionRecord, CommandDispatchResult, LedgerError} from '../types/execution';
import type {RequestExecutionRecord} from '../types/requestLedger';
import type {RuntimeLimits} from '../types/limits';
import type {RuntimeJournalWithAppend} from './createRuntimeJournal';
import type {PeerDispatchGateway} from '../types/peer';
import {commandDefinitionBrand} from '../types/command';
import type {RegisteredCommandDefinition} from '../types/command';
import type {RuntimeLifecycleObserver} from '../types/journal';
import type {RuntimeRoleChangeSignal} from '../types/module';
import {
  createLifecycleEmitter,
  type LifecycleCommandContext,
  type LifecycleEmitterResult,
  type LifecycleLedgerWriter,
} from './createLifecycleEmitter';
import {
  createCommandActorDispatcher,
  type ActorInvocationAncestor,
  type CommandChainEntry,
} from './createCommandActorDispatcher';
import {createCommandPeerDispatcher} from './createCommandPeerDispatcher';
import {aggregateCommandStatus} from './aggregateCommandStatus';
import {normalizeRuntimeError} from './normalizeRuntimeError';
import {createStateSubscription} from './createStateSubscription';
import {freezeList} from './freezeList';
import {findExpiredRequestLedgerIds} from './findExpiredRequestLedgerIds';
import {
  createRequestLedgerActionDispatcher,
  requestLedgerActionsForMode,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
} from '../features/slices/requestLedger';
import {selectRuntimeInstanceMode} from '../selectors/selectRuntimeInstanceMode';
import {selectRequestExecutionView} from '../selectors/selectRequestExecutionView';

const depthErrorKey = 'kernel.base.runtime.command_depth_rejected';
const invalidDefinitionErrorKey = 'kernel.base.runtime.command_definition_invalid';
const missingRequestErrorKey = 'kernel.base.runtime.request_id_required';
const requestBudgetErrorKey = 'kernel.base.runtime.request_budget_exceeded';
const requestBudgetActorKey = 'kernel.base.runtime.request-budget';
const ledgerWriteFailureErrorKey = 'kernel.base.runtime.ledger_write_failed';

const runtimeErrorDefinition = (key: string, name: string, code: string) => ({
  key,
  name,
  defaultTemplate: name,
  category: 'SYSTEM' as const,
  severity: 'MEDIUM' as const,
  code,
  moduleName: 'kernel.base.runtime',
});

type DispatcherInput = Readonly<{
  runtimeId: import('@catering-v2s/kernel-base-contracts').RuntimeInstanceId;
  localNodeId: import('@catering-v2s/kernel-base-contracts').NodeId;
  platformPorts: PlatformPorts;
  logger: LoggerPort;
  stateRuntime: StateRuntime;
  limits: RuntimeLimits;
  definitionsByName: ReadonlyMap<string, RegisteredCommandDefinition>;
  handlersByCommand: ReadonlyMap<string, readonly RegisteredActorHandler[]>;
  getSessionId?: () => import('@catering-v2s/kernel-base-contracts').SessionId | null;
  onLifecycleEvent?: import('../types/journal').RuntimeLifecycleObserver;
  journal?: RuntimeJournalWithAppend;
  performReset?: (reason: string | undefined, rootCommandId: CommandId) => Promise<void>;
  isResetting?: () => boolean;
  registerResource?: (cleanup: () => void) => () => void;
  resolveCommandTarget?: import('../types/command').CommandTargetResolver;
  roleChangeSignalRef?: {
    current?: (signal: RuntimeRoleChangeSignal) => void;
  };
}>;

const safeLedgerDetailKeys = new Set(['operation', 'phase', 'childStatus', 'childErrorCode', 'categoryWasBusiness']);

const safeLedgerDetails = (value: unknown): LedgerError['details'] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const details: Record<string, string | number | boolean | null> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!safeLedgerDetailKeys.has(key)) continue;
    if (entry !== null && typeof entry !== 'string' && typeof entry !== 'number' && typeof entry !== 'boolean')
      continue;
    details[key] = entry;
  }
  return Object.keys(details).length === 0 ? undefined : Object.freeze(details);
};

const toLedgerError = (error: AppError): LedgerError => {
  const details = safeLedgerDetails(error.details);
  return Object.freeze({
    key: error.key,
    code: error.code,
    message: error.message,
    category: error.category,
    severity: error.severity,
    ...(details === undefined ? {} : {details}),
  });
};

const makeAppError = (
  input: Readonly<{
    key: string;
    name: string;
    code: string;
    message: string;
    context: LifecycleCommandContext;
    cause?: unknown;
    sessionId?: import('@catering-v2s/kernel-base-contracts').SessionId | null;
  }>,
): AppError =>
  createAppError(runtimeErrorDefinition(input.key, input.name, input.code), {
    args: {},
    context: {
      commandName: input.context.commandName,
      commandId: input.context.commandId,
      requestId: input.context.requestId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      nodeId: input.context.localNodeId,
    },
    details: {message: input.message},
    cause: input.cause,
  });

const ledgerWriteFailureError = (context: LifecycleCommandContext, cause: unknown): AppError => {
  const normalized = normalizeRuntimeError(cause, {
    commandName: context.commandName,
    commandId: context.commandId,
    requestId: context.requestId,
    sessionId: null,
    nodeId: context.localNodeId,
  });
  return createAppError(
    runtimeErrorDefinition(
      ledgerWriteFailureErrorKey,
      'Runtime request ledger write failed',
      'ERR_TER_RUNTIME_LEDGER_WRITE_FAILED',
    ),
    {
      args: {},
      context: {
        commandName: context.commandName,
        commandId: context.commandId,
        requestId: context.requestId ?? undefined,
        nodeId: context.localNodeId,
      },
      details: {message: normalized.message},
      cause,
    },
  );
};

export const createCommandDispatcher = (input: DispatcherInput) => {
  const writeLedgerTransition: LifecycleLedgerWriter = (transition, observation, depthRecord): void => {
    const requestId = transition.context.requestId;
    if (requestId === null || observation === undefined) return;
    const mode = selectRuntimeInstanceMode(input.stateRuntime.getState());
    const sliceName = requestLedgerSliceNameForMode(mode);
    const now = nowTimestampMs();
    const currentState = input.stateRuntime.getState()[sliceName];
    const currentRecord = readLiveRequestEnvelope(
      typeof currentState === 'object' && currentState !== null
        ? (currentState as import('../features/slices/requestLedger').RuntimeRequestLedgerState)
        : undefined,
      requestId,
    )?.value;
    const existingCommands = currentRecord?.commands ?? [];
    const commandIndex = existingCommands.findIndex(item => item.commandId === observation.commandId);
    const nextCommands =
      commandIndex < 0
        ? [...existingCommands, observation]
        : existingCommands.map((item, index) => (index === commandIndex ? observation : item));
    const updatedAt =
      'completedAt' in transition && typeof transition.completedAt === 'number' ? transition.completedAt : now;
    // StateRuntime owns the reducer and sync shape; lifecycle remains the
    // single fact-producing call point while this action is only a transport
    // into the owner slice.
    try {
      if (transition.context.commandName === 'ui.integration.sample-console.startup-ready') {
        input.logger.info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-ledger-write-start',
          message: 'PRIMARY startup-ready ledger transition started',
          data: {transition: transition.kind, requestId: transition.context.requestId},
        });
      }
      const dispatchRequestLedgerAction = createRequestLedgerActionDispatcher(
        () => selectRuntimeInstanceMode(input.stateRuntime.getState()),
        action => {
          if (transition.context.commandName === 'ui.integration.sample-console.startup-ready') {
            input.logger.info({
              category: 'startup.ready-dispatch',
              event: 'startup.ready-ledger-dispatch-start',
              message: 'PRIMARY startup-ready ledger store dispatch started',
              data: {transition: transition.kind},
            });
          }
          const result = input.stateRuntime.getStore().dispatch(action);
          if (transition.context.commandName === 'ui.integration.sample-console.startup-ready') {
            input.logger.info({
              category: 'startup.ready-dispatch',
              event: 'startup.ready-ledger-dispatch-end',
              message: 'PRIMARY startup-ready ledger store dispatch completed',
              data: {transition: transition.kind},
            });
          }
          return result;
        },
      );
      if (currentRecord === undefined) {
        const expiredRequestIds = findExpiredRequestLedgerIds({
          state: input.stateRuntime.getState(),
          mode,
          limits: input.limits,
          now,
        });
        if (expiredRequestIds.length > 0) {
          dispatchRequestLedgerAction(currentMode =>
            requestLedgerActionsForMode(currentMode).deleteRecords({
              requestIds: expiredRequestIds,
            }),
          );
        }
      }
      const record: RequestExecutionRecord = Object.freeze({
        requestId,
        workspace:
          currentRecord === undefined ? (transition.context.routeContext?.workspace ?? null) : currentRecord.workspace,
        startedAt:
          currentRecord === undefined
            ? observation.startedAt
            : Math.min(currentRecord.startedAt, observation.startedAt),
        commands: Object.freeze(nextCommands),
      });
      dispatchRequestLedgerAction(mode =>
        requestLedgerActionsForMode(mode).upsert({
          record,
          updatedAt,
        }),
      );
      if (transition.context.commandName === 'ui.integration.sample-console.startup-ready') {
        input.logger.info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-ledger-write-end',
          message: 'PRIMARY startup-ready ledger transition completed',
          data: {transition: transition.kind},
        });
      }
    } catch (error) {
      throw ledgerWriteFailureError(transition.context, error);
    }
    void depthRecord;
  };
  const emitter = createLifecycleEmitter({
    runtimeId: input.runtimeId,
    localNodeId: input.localNodeId,
    logger: input.logger,
    maxJournalRecords: input.limits.maxJournalRecords,
    onLifecycleEvent: input.onLifecycleEvent,
    sessionId: input.getSessionId,
    journal: input.journal,
    onLedgerTransition: writeLedgerTransition,
  });
  const commandChains = new Map<string, readonly CommandChainEntry[]>();
  const pendingResetByRoot = new Map<string, string | undefined>();
  const activeRoleContexts = new Map<
    string,
    Readonly<{
      context: LifecycleCommandContext;
      observer?: RuntimeLifecycleObserver;
    }>
  >();
  let peerGateway: PeerDispatchGateway | undefined;
  let dispatchActor!: ReturnType<typeof createCommandActorDispatcher>;
  let dispatchPeer!: ReturnType<typeof createCommandPeerDispatcher>;

  const validateRegisteredDefinition = <TPayload extends StateJsonValue>(
    definition: CommandDefinition<TPayload>,
  ): void => {
    if (typeof definition !== 'object' || definition === null || !(commandDefinitionBrand in definition)) {
      throw new Error(`${invalidDefinitionErrorKey}: definition is not factory-created`);
    }
    const registered = input.definitionsByName.get(definition.commandName);
    if (
      registered === undefined ||
      registered.moduleName !== definition.moduleName ||
      registered.visibility !== definition.visibility ||
      registered.timeoutMs !== definition.timeoutMs ||
      registered.allowNoActor !== definition.allowNoActor ||
      registered.allowReentry !== definition.allowReentry ||
      registered.defaultTarget !== definition.defaultTarget
    ) {
      throw new Error(`${invalidDefinitionErrorKey}: ${definition.commandName}`);
    }
  };

  const emit = (
    transition: Parameters<typeof emitter.emitLifecycle>[0],
    observer?: import('../types/journal').RuntimeLifecycleObserver,
  ): LifecycleEmitterResult => {
    const result = emitter.emitLifecycle(transition, observer);
    if (result.ledgerWriteFailed === true) {
      // Actor transitions use the per-actor helpers below so one actor can
      // degrade to a typed error without discarding sibling results. All
      // other transitions have no actor slot to carry the failure; rejecting
      // here prevents a missing ledger write from being reported as success.
      throw ledgerWriteFailureError(transition.context, result.error);
    }
    return result;
  };

  const emitActorRunning = (
    transition: Extract<Parameters<typeof emitter.emitLifecycle>[0], {kind: 'actor.running'}>,
    observer?: import('../types/journal').RuntimeLifecycleObserver,
  ): ActorExecutionRecord | undefined => {
    const result = emitter.emitLifecycle(transition, observer);
    if (result.ledgerWriteFailed !== true) return undefined;
    // The emitter replaces the in-memory running record with a terminal error
    // before reporting the failed ledger write, so the actor must stop here.
    if (result.record === undefined || result.record.status !== 'error') {
      throw ledgerWriteFailureError(transition.context, result.error);
    }
    return result.record;
  };

  const emitActorTerminal = (
    transition: Extract<
      Parameters<typeof emitter.emitLifecycle>[0],
      {kind: 'actor.completed' | 'actor.error' | 'actor.timed-out'}
    >,
    observer?: import('../types/journal').RuntimeLifecycleObserver,
  ): ActorExecutionRecord => {
    const result = emitter.emitLifecycle(transition, observer);
    if (result.ledgerWriteFailed === true) {
      // The emitter replaces the in-memory actor record before reporting the
      // failed ledger write. Returning that same record keeps the dispatcher,
      // journal and subsequent command completion on one fact-producing path.
      if (result.record === undefined || result.record.status !== 'error') {
        throw ledgerWriteFailureError(transition.context, result.error);
      }
      return result.record;
    }
    if (result.record === undefined) {
      throw new Error('Lifecycle emitter did not return an actor record');
    }
    return result.record;
  };

  const subscribeState = (listener: () => void): (() => void) =>
    createStateSubscription(input.stateRuntime.getStore(), listener, input.registerResource);

  const commandLogger = (context: LifecycleCommandContext): LoggerPort =>
    input.logger.withContext({
      requestId: context.requestId ?? undefined,
      commandId: context.commandId,
      commandName: context.commandName,
      sessionId: input.getSessionId?.() ?? undefined,
      nodeId: context.localNodeId,
    });

  if (input.roleChangeSignalRef !== undefined) {
    input.roleChangeSignalRef.current = signal => {
      const active = activeRoleContexts.get(String(signal.context.command.commandId));
      // A timed-out actor may finish after the command accumulator is released.
      // The internal role command has a fixed definition, so its actor context
      // still carries enough identity to keep the late lifecycle event truthful
      // without retaining an unbounded command map.
      const fallbackContext: LifecycleCommandContext = {
        runtimeId: signal.context.runtimeId,
        localNodeId: signal.context.localNodeId,
        requestId: signal.context.command.requestId,
        commandId: signal.context.command.commandId,
        parentCommandId: signal.context.command.parentCommandId,
        commandName: signal.context.command.commandName,
        visibility: signal.visibility,
        target: signal.context.command.target,
        allowNoActor: signal.allowNoActor,
        routeContext: signal.context.command.routeContext,
        startedAt: signal.context.command.dispatchedAt,
      };
      emit(
        {
          kind: signal.kind,
          context: active?.context ?? fallbackContext,
          previousMode: signal.previousMode,
          nextMode: signal.nextMode,
        },
        active?.observer,
      );
    };
  }

  const contextFor = <TPayload extends StateJsonValue>(
    command: DispatchedCommand<TPayload>,
    definition: CommandDefinition<TPayload>,
  ): LifecycleCommandContext => ({
    runtimeId: input.runtimeId,
    localNodeId: input.localNodeId,
    requestId: command.requestId,
    commandId: command.commandId,
    parentCommandId: command.parentCommandId,
    commandName: command.commandName,
    visibility: definition.visibility,
    target: command.target,
    allowNoActor: definition.allowNoActor,
    routeContext: command.routeContext,
    startedAt: command.dispatchedAt,
  });

  const normalize = (error: unknown, command: DispatchedCommand): LedgerError =>
    toLedgerError(
      normalizeRuntimeError(error, {
        commandName: command.commandName,
        commandId: command.commandId,
        requestId: command.requestId,
        sessionId: input.getSessionId?.() ?? null,
        nodeId: input.localNodeId,
      }),
    );

  const budgetErrorFor = (context: LifecycleCommandContext): AppError =>
    makeAppError({
      key: requestBudgetErrorKey,
      name: 'Runtime request command budget exceeded',
      code: 'ERR_TER_RUNTIME_REQUEST_BUDGET_EXCEEDED',
      message: `Request command budget exceeded ${input.limits.maxCommandsPerRequest}`,
      context,
      sessionId: input.getSessionId?.() ?? null,
    });

  const hasBudgetObservation = (view: ReturnType<typeof selectRequestExecutionView>): boolean =>
    view?.commands.some(command => command.errors.some(error => error.key === requestBudgetErrorKey)) ?? false;

  const emitBudgetRejection = (
    input: Readonly<{
      context: LifecycleCommandContext;
      budgetError: AppError;
      observer?: RuntimeLifecycleObserver;
    }>,
  ): void => {
    emit({kind: 'command.started', context: input.context}, input.observer);
    const budgetStartedAt = nowTimestampMs();
    emit(
      {
        kind: 'actor.running',
        context: input.context,
        actorKey: requestBudgetActorKey,
        startedAt: budgetStartedAt,
      },
      input.observer,
    );
    emit(
      {
        kind: 'actor.error',
        context: input.context,
        actorKey: requestBudgetActorKey,
        startedAt: budgetStartedAt,
        completedAt: nowTimestampMs(),
        result: null,
        error: toLedgerError(input.budgetError),
      },
      input.observer,
    );
    emit({kind: 'command.completed', context: input.context, completedAt: nowTimestampMs()}, input.observer);
  };

  const requestBudgetErrorForView = (
    input: Readonly<{
      view: ReturnType<typeof selectRequestExecutionView>;
      context: LifecycleCommandContext;
      observer?: RuntimeLifecycleObserver;
    }>,
  ): AppError => {
    const budgetError = budgetErrorFor(input.context);
    if (!hasBudgetObservation(input.view)) {
      emitBudgetRejection({
        context: input.context,
        budgetError,
        observer: input.observer,
      });
    }
    return budgetError;
  };

  const dispatchInternal = async <TPayload extends StateJsonValue>(
    dispatchInput: Readonly<{
      definition: CommandDefinition<TPayload>;
      payload: TPayload;
      options?: CommandDispatchOptions | ActorDispatchOptions;
      observer?: import('../types/journal').RuntimeLifecycleObserver;
      actorAncestors?: readonly ActorInvocationAncestor[];
    }>,
  ): Promise<CommandDispatchResult> => {
    const {definition, payload, options = {}, observer, actorAncestors = []} = dispatchInput;
    validateRegisteredDefinition(definition);

    const requestId = options.requestId ?? null;
    if (definition.visibility === 'public' && requestId === null) {
      throw createAppError(
        runtimeErrorDefinition(
          missingRequestErrorKey,
          'Runtime public command requires request id',
          'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED',
        ),
        {
          args: {},
          context: {commandName: definition.commandName},
        },
      );
    }
    const commandId = options.commandId ?? createCommandId();
    const parentCommandId = options.parentCommandId ?? null;
    const routeContext = options.routeContext === undefined ? null : options.routeContext;
    const target =
      options.target ??
      input.resolveCommandTarget?.({
        payload,
        routeContext,
        routeIntent: options.routeIntent,
        state: input.stateRuntime.getState(),
      }) ??
      definition.defaultTarget;
    const isStartupReadyCommand = definition.commandName === 'ui.integration.sample-console.startup-ready';
    if (isStartupReadyCommand) {
      input.logger.info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-dispatch-target',
        message: 'Resolved PRIMARY startup-ready command target',
        data: {target, routeIntent: options.routeIntent ?? null, hasRouteContext: routeContext !== null},
      });
    }
    const command: DispatchedCommand<TPayload> = Object.freeze({
      runtimeId: input.runtimeId,
      requestId,
      commandId,
      parentCommandId,
      commandName: definition.commandName,
      payload,
      target,
      routeContext,
      dispatchedAt: nowTimestampMs(),
    });
    const context = contextFor(command, definition);
    const parentChain = parentCommandId === null ? [] : (commandChains.get(String(parentCommandId)) ?? []);
    const chain: readonly CommandChainEntry[] = freezeList([
      ...parentChain,
      Object.freeze({commandName: command.commandName, commandId}),
    ]);
    commandChains.set(String(commandId), chain);
    let resetStarted = false;
    try {
      if (requestId !== null) {
        const currentView = selectRequestExecutionView(input.stateRuntime.getState(), requestId);
        if (currentView !== null && currentView.commands.length >= input.limits.maxCommandsPerRequest) {
          throw requestBudgetErrorForView({view: currentView, context, observer});
        }
      }
      if (chain.length > input.limits.maxCommandDepth) {
        const error = makeAppError({
          key: depthErrorKey,
          name: 'Runtime command depth exceeded',
          code: 'ERR_TER_RUNTIME_COMMAND_DEPTH_EXCEEDED',
          message: `Command depth exceeded ${input.limits.maxCommandDepth}`,
          context,
          sessionId: input.getSessionId?.() ?? null,
        });
        const depthResult = emit(
          {
            kind: 'command.depth-rejected',
            context,
            commandChain: chain,
            error: toLedgerError(error),
          },
          observer,
        );
        return Object.freeze({
          requestId,
          commandId,
          status: 'error',
          actorResults: depthResult.record === undefined ? freezeList([]) : freezeList([depthResult.record]),
        });
      }

      emit({kind: 'command.started', context}, observer);
      if (isStartupReadyCommand) {
        input.logger.info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-dispatch-started',
          message: 'PRIMARY startup-ready command entered dispatcher',
          data: {target},
        });
      }
      activeRoleContexts.set(String(commandId), Object.freeze({context, observer}));

      const handlers = target === 'local' ? [...(input.handlersByCommand.get(command.commandName) ?? [])] : [];
      if (isStartupReadyCommand) {
        input.logger.info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-dispatch-handlers',
          message: 'Resolved PRIMARY startup-ready command handlers',
          data: {target, handlerCount: handlers.length},
        });
      }
      const actorResults =
      target === 'peer'
          ? [await dispatchPeer({
              command,
              definition,
              lifecycleContext: context,
              observer,
              lateOutcome: options.lateOutcome,
              lateResultTtlMs: options.lateResultTtlMs,
            })]
          : await Promise.all(
              handlers.map(handler =>
                dispatchActor({
                  handler,
                  command,
                  definition,
                  lifecycleContext: context,
                  observer,
                  actorAncestors,
                  lateOutcome: options.lateOutcome,
                  lateResultTtlMs: options.lateResultTtlMs,
                }),
              ),
            );
      if (isStartupReadyCommand) {
        input.logger.info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-dispatch-actors-settled',
          message: 'PRIMARY startup-ready command actors settled',
          data: {target, actorCount: actorResults.length},
        });
      }

      const completedAt = nowTimestampMs();
      emit({kind: 'command.completed', context, completedAt}, observer);
      const observation = emitter.getObservation(commandId);
      const resultActorResults = observation?.actorResults ?? actorResults;
      const status =
        emitter.aggregate(commandId) ??
        aggregateCommandStatus({
          actorResults: resultActorResults,
          completedAt,
          allowNoActor: definition.allowNoActor,
        });
      const result: CommandDispatchResult = Object.freeze({
        requestId,
        commandId,
        status,
        actorResults: freezeList(resultActorResults),
      });

      if (parentCommandId === null) {
        const resetKey = String(commandId);
        const pendingReason = pendingResetByRoot.get(resetKey);
        if (pendingResetByRoot.has(resetKey)) {
          resetStarted = true;
          await input.performReset?.(pendingReason, commandId);
        }
      }
      return result;
    } finally {
      if (parentCommandId === null) {
        const resetKey = String(commandId);
        if (pendingResetByRoot.has(resetKey) && !resetStarted) {
          commandLogger(context).warn({
            category: 'runtime.reset',
            event: 'runtime.reset.request-discarded-after-root-failure',
            message: 'reset request discarded after root command failure',
            data: {
              rootCommandId: String(commandId),
              hasReason: pendingResetByRoot.get(resetKey) !== undefined,
            },
          });
        }
        pendingResetByRoot.delete(resetKey);
      }
      activeRoleContexts.delete(String(commandId));
      commandChains.delete(String(commandId));
      emitter.releaseCommand(commandId);
    }
  };

  const dispatchCommand = <TPayload extends StateJsonValue>(
    definition: CommandDefinition<TPayload>,
    payload: TPayload,
    options: CommandDispatchOptions | ActorDispatchOptions = {},
  ): Promise<CommandDispatchResult> => dispatchInternal({definition, payload, options});

  dispatchActor = createCommandActorDispatcher({
    runtimeId: input.runtimeId,
    localNodeId: input.localNodeId,
    platformPorts: input.platformPorts,
    stateRuntime: input.stateRuntime,
    limits: {maxActorResultBytes: input.limits.maxActorResultBytes},
    getSessionId: input.getSessionId,
    registerResource: input.registerResource,
    subscribeState,
    getCommandChain: commandId => commandChains.get(String(commandId)),
    isResetting: input.isResetting,
    hasPendingReset: rootCommandId => pendingResetByRoot.has(String(rootCommandId)),
    getPendingResetReason: rootCommandId => pendingResetByRoot.get(String(rootCommandId)),
    setPendingReset: (rootCommandId, reason) => {
      pendingResetByRoot.set(String(rootCommandId), reason);
    },
    dispatchInternal,
    resolveCommandDefinition: commandName =>
      input.definitionsByName.get(commandName)?.definition as CommandDefinition | undefined,
    emit,
    emitActorRunning,
    emitActorTerminal,
    commandLogger,
    normalize,
    toLedgerError,
    makeRuntimeError: makeAppError,
    ledgerWriteFailureErrorKey,
  });

  const createPeerResultError = (context: LifecycleCommandContext): AppError =>
    createAppError(
      runtimeErrorDefinition(
        'kernel.base.runtime.peer_result_failed',
        'Runtime peer command failed',
        'ERR_TER_RUNTIME_PEER_RESULT_FAILED',
      ),
      {
        args: {},
        context: {
          commandName: context.commandName,
          commandId: context.commandId,
          requestId: context.requestId ?? undefined,
          sessionId: input.getSessionId?.() ?? undefined,
          nodeId: input.localNodeId,
        },
      },
    );

  dispatchPeer = createCommandPeerDispatcher({
    getPeerGateway: () => peerGateway,
    getSessionId: input.getSessionId,
    registerResource: input.registerResource,
    emit,
    emitActorRunning,
    emitActorTerminal,
    normalize,
    toLedgerError,
    createPeerResultError,
    makeRuntimeError: makeAppError,
    ledgerWriteFailureErrorKey,
  });

  return Object.freeze({
    dispatchCommand,
    installPeerDispatchGateway: (gateway: PeerDispatchGateway): void => {
      if (peerGateway !== undefined) throw new Error('Peer dispatch gateway already installed');
      peerGateway = gateway;
    },
    journal: emitter.journal,
    getObservation: emitter.getObservation,
    aggregate: emitter.aggregate,
  });
};
