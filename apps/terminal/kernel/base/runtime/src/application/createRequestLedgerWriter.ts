import {createAppError, nowTimestampMs, type AppError} from '@catering-v2s/kernel-base-contracts';
import type {StateRuntime} from '@catering-v2s/kernel-base-state';
import type {RuntimeLimits} from '../types/limits';
import type {LedgerError} from '../types/execution';
import type {RequestExecutionRecord} from '../types/requestLedger';
import {requestLedgerActionsForMode} from '../features/slices/requestLedgerActions';
import {findExpiredRequestLedgerIds} from '../foundations/findExpiredRequestLedgerIds';
import type {LifecycleCommandContext, LifecycleLedgerWriter} from '../foundations/createLifecycleEmitter';
import {normalizeRuntimeError} from '../foundations/normalizeRuntimeError';
import {
  createRequestLedgerActionDispatcher,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
  type RuntimeRequestLedgerState,
} from '../foundations/requestLedgerState';
import {selectRuntimeInstanceMode} from '../selectors/selectRuntimeInstanceMode';

export const ledgerWriteFailureErrorKey = 'kernel.base.runtime.ledger_write_failed';

const safeLedgerDetailKeys = new Set([
  'operation',
  'phase',
  'childStatus',
  'childErrorCode',
  'categoryWasBusiness',
  'runtimeCauseName',
  'runtimeCauseCode',
]);

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

export const toLedgerError = (error: AppError): LedgerError => {
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

export const ledgerWriteFailureError = (context: LifecycleCommandContext, cause: unknown): AppError => {
  const normalized = normalizeRuntimeError(cause, {
    commandName: context.commandName,
    commandId: context.commandId,
    requestId: context.requestId,
    sessionId: null,
    nodeId: context.localNodeId,
  });
  return createAppError(
    {
      key: ledgerWriteFailureErrorKey,
      name: 'Runtime request ledger write failed',
      defaultTemplate: 'Runtime request ledger write failed',
      category: 'SYSTEM',
      severity: 'MEDIUM',
      code: 'ERR_TER_RUNTIME_LEDGER_WRITE_FAILED',
      moduleName: 'kernel.base.runtime',
    },
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

export const createRequestLedgerWriter = (
  input: Readonly<{stateRuntime: StateRuntime; limits: RuntimeLimits}>,
): LifecycleLedgerWriter =>
  (transition, observation, depthRecord): void => {
    const requestId = transition.context.requestId;
    if (requestId === null || observation === undefined) return;
    const mode = selectRuntimeInstanceMode(input.stateRuntime.getState());
    const sliceName = requestLedgerSliceNameForMode(mode);
    const now = nowTimestampMs();
    const currentState = input.stateRuntime.getState()[sliceName];
    const currentRecord = readLiveRequestEnvelope(
      typeof currentState === 'object' && currentState !== null
        ? (currentState as RuntimeRequestLedgerState)
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
    try {
      const dispatchRequestLedgerAction = createRequestLedgerActionDispatcher(
        () => selectRuntimeInstanceMode(input.stateRuntime.getState()),
        action => input.stateRuntime.getStore().dispatch(action),
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
            requestLedgerActionsForMode(currentMode).deleteRecords({requestIds: expiredRequestIds}),
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
      dispatchRequestLedgerAction(currentMode =>
        requestLedgerActionsForMode(currentMode).upsert({record, updatedAt}),
      );
    } catch (error) {
      throw ledgerWriteFailureError(transition.context, error);
    }
    void depthRecord;
  };
