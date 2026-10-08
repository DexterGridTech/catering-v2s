import {randomUUID} from 'node:crypto';
import {filter, firstValueFrom, ReplaySubject, Subject, take, timeout} from 'rxjs';
import type {AutomationDriverServer} from './server.js';

type RequestView = Readonly<{
  readonly requestId: string;
  readonly status: string;
  readonly rootCommandIds: readonly string[];
  readonly workspace: 'MAIN' | 'BRANCH' | null;
  readonly commands: readonly Readonly<{
    readonly commandId: string;
    readonly commandName: string;
    readonly parentCommandId: string | null;
    readonly displayMode: 'PRIMARY' | 'SECONDARY' | null;
    readonly status: string;
    readonly results: readonly unknown[];
    readonly errors: readonly unknown[];
  }>[];
}>;

type SelectorListEvent = Readonly<{
  readonly subscriptionId: string;
  readonly valueState: 'JSON';
  readonly value: unknown;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRequestView = (value: unknown): value is RequestView => {
  if (!isRecord(value) || typeof value.requestId !== 'string' || typeof value.status !== 'string') return false;
  return (
    Array.isArray(value.rootCommandIds) &&
    Array.isArray(value.commands) &&
    (value.workspace === null || value.workspace === 'MAIN' || value.workspace === 'BRANCH') &&
    value.commands.every(
      command =>
        isRecord(command) &&
        typeof command.commandId === 'string' &&
        typeof command.commandName === 'string' &&
        typeof command.status === 'string' &&
        (command.parentCommandId === null || typeof command.parentCommandId === 'string') &&
        (command.displayMode === null || command.displayMode === 'PRIMARY' || command.displayMode === 'SECONDARY') &&
        Array.isArray(command.results) &&
        Array.isArray(command.errors),
    )
  );
};

const rootCommands = (view: RequestView) =>
  view.commands.filter(command => view.rootCommandIds.includes(command.commandId) && command.parentCommandId === null);

const resultOf = (response: Awaited<ReturnType<AutomationDriverServer['request']>>): unknown => {
  if (response.type === 'error') {
    const body = response.body;
    throw new Error(isRecord(body) && typeof body.code === 'string' ? body.code : 'TERMINAL_AUTOMATION_AGENT_ERROR');
  }
  if (response.type !== 'response' || !isRecord(response.body) || !('result' in response.body)) {
    throw new Error('TERMINAL_AUTOMATION_AGENT_RESPONSE_INVALID');
  }
  return response.body.result;
};

const isSelectorListEvent = (
  message: {type: string; body: unknown},
  subscriptionId: string,
): message is {type: string; body: SelectorListEvent} =>
  message.type === 'event' &&
  isRecord(message.body) &&
  message.body.subscriptionId === subscriptionId &&
  message.body.valueState === 'JSON' &&
  'value' in message.body;

const readSelector = async (
  server: AutomationDriverServer,
  sessionId: string,
  selectorName: string,
  argsTuple: readonly unknown[],
): Promise<unknown> => {
  const result = resultOf(await server.request(sessionId, 'selector.read', {selectorName, argsTuple}));
  if (!isRecord(result) || result.valueState !== 'JSON') throw new Error('TERMINAL_AUTOMATION_SELECTOR_VALUE_NOT_JSON');
  return result.value;
};

const terminalRequestStatuses = new Set(['completed', 'partial-failed', 'timed-out', 'error']);

const matchingCandidates = (
  views: Iterable<RequestView>,
  baselineIds: ReadonlySet<string>,
  input: Readonly<{workspace: 'MAIN' | 'BRANCH'; displayMode: 'PRIMARY' | 'SECONDARY'; commandName: string}>,
): readonly RequestView[] =>
  [...views].filter(view => {
    if (baselineIds.has(view.requestId)) return false;
    if (view.workspace !== null && view.workspace !== input.workspace) return false;
    return rootCommands(view).some(
      command =>
        command.commandName === input.commandName &&
        (command.displayMode === null || command.displayMode === input.displayMode),
    );
  });

export const requests = Object.freeze({
  observeUiAction: async <T>(
    input: Readonly<{
      readonly server: AutomationDriverServer;
      readonly sessionId: string;
      readonly workspace: 'MAIN' | 'BRANCH';
      readonly displayMode: 'PRIMARY' | 'SECONDARY';
      readonly commandName: string;
      readonly action: () => Promise<T>;
      readonly timeoutMs?: number;
      readonly onRequestIdentified?: (requestId: string) => void;
      readonly onRequestFinished?: (requestId: string) => void;
    }>,
  ): Promise<Readonly<{readonly requestId: string; readonly view: RequestView; readonly actionResult: T}>> => {
    const timeoutMs = input.timeoutMs ?? 30_000;
    const listSubscriptionId = `request-list-${randomUUID()}`;
    const updates = new ReplaySubject<readonly RequestView[]>(1);
    const views = new Map<string, RequestView>();
    const listListener = input.server.onMessage(input.sessionId, message => {
      if (!isSelectorListEvent(message, listSubscriptionId)) return;
      if (!Array.isArray(message.body.value) || !message.body.value.every(isRequestView)) {
        updates.error(new Error('TERMINAL_AUTOMATION_REQUEST_LIST_INVALID'));
        return;
      }
      views.clear();
      for (const view of message.body.value) views.set(view.requestId, view);
      updates.next(Object.freeze([...views.values()]));
    });
    let listSubscribed = false;
    let exactSubscriptionId: string | undefined;
    let exactListener: (() => void) | undefined;
    const releaseListSubscription = async (): Promise<void> => {
      if (!listSubscribed) return;
      listSubscribed = false;
      listListener();
      updates.complete();
      const response = await input.server.request(input.sessionId, 'selector.unsubscribe', {
        subscriptionId: listSubscriptionId,
      });
      const result = resultOf(response);
      if (!isRecord(result) || result.released !== true) {
        throw new Error('TERMINAL_AUTOMATION_REQUEST_LIST_UNSUBSCRIBE_FAILED');
      }
    };
    try {
      const accepted = resultOf(
        await input.server.request(input.sessionId, 'selector.subscribe', {
          subscriptionId: listSubscriptionId,
          selectorName: 'kernel.base.runtime.selectRequestExecutionViews',
          argsTuple: [input.workspace],
        }),
      );
      if (!isRecord(accepted) || accepted.accepted !== true || accepted.subscriptionId !== listSubscriptionId) {
        throw new Error('TERMINAL_AUTOMATION_REQUEST_LIST_SUBSCRIBE_FAILED');
      }
      listSubscribed = true;
      // The handler publishes the first value synchronously after the subscribe response.
      // subscribe publishes the current full list before resolving. Keep using
      // that maintained snapshot instead of synchronously serializing the same
      // broad selector a second time; large live ledgers can exceed the
      // Runtime's per-selector serialization budget on device.
      await firstValueFrom(updates.pipe(take(1), timeout({first: timeoutMs})));
      const baselineIds = new Set(views.keys());
      const actionResult = await input.action();

      // Updates remain subscribed while the real action executes, so fast completion cannot be missed.
      const findCandidate = (): RequestView => {
        const candidates = matchingCandidates(views.values(), baselineIds, input);
        if (candidates.length > 1) throw new Error('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_AMBIGUOUS');
        if (candidates.length === 0) throw new Error('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_NOT_FOUND');
        return candidates[0]!;
      };
      let candidate: RequestView;
      try {
        candidate = findCandidate();
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'TERMINAL_AUTOMATION_UI_ACTION_REQUEST_NOT_FOUND')
          throw error;
        const next = await firstValueFrom(
          updates.pipe(
            filter(() => matchingCandidates(views.values(), baselineIds, input).length > 0),
            take(1),
            timeout({first: timeoutMs}),
          ),
        );
        for (const view of next) views.set(view.requestId, view);
        candidate = findCandidate();
      }
      input.onRequestIdentified?.(candidate.requestId);

      // The design uses the collection only to identify one new request. Its
      // precise selector has a current-value emission, so release the broader
      // collection before observing that request's terminal result.
      await releaseListSubscription();

      exactSubscriptionId = `request-${candidate.requestId}-${randomUUID()}`;
      const exactValues = new ReplaySubject<RequestView>(1);
      exactListener = input.server.onMessage(input.sessionId, message => {
        if (message.type !== 'event' || !isRecord(message.body) || message.body.subscriptionId !== exactSubscriptionId)
          return;
        if (
          message.body.valueState !== 'JSON' ||
          !isRequestView(message.body.value) ||
          message.body.value.requestId !== candidate.requestId
        ) {
          exactValues.error(new Error('TERMINAL_AUTOMATION_REQUEST_RESULT_INVALID'));
          return;
        }
        exactValues.next(message.body.value);
      });
      const exactAccepted = resultOf(
        await input.server.request(input.sessionId, 'selector.subscribe', {
          subscriptionId: exactSubscriptionId,
          selectorName: 'kernel.base.runtime.selectRequestExecutionView',
          argsTuple: [candidate.requestId],
        }),
      );
      if (
        !isRecord(exactAccepted) ||
        exactAccepted.accepted !== true ||
        exactAccepted.subscriptionId !== exactSubscriptionId
      ) {
        throw new Error('TERMINAL_AUTOMATION_REQUEST_RESULT_SUBSCRIBE_FAILED');
      }
      const view = await firstValueFrom(
        exactValues.pipe(
          filter(value => terminalRequestStatuses.has(value.status)),
          take(1),
          timeout({first: timeoutMs}),
        ),
      );
      input.onRequestFinished?.(candidate.requestId);
      const root = rootCommands(view).find(command => command.commandName === input.commandName);
      if (root === undefined || (root.displayMode !== null && root.displayMode !== input.displayMode)) {
        throw new Error('TERMINAL_AUTOMATION_UI_ACTION_ROOT_COMMAND_MISMATCH');
      }
      if (view.status !== 'completed' || root.status !== 'completed' || root.errors.length !== 0) {
        throw new Error('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_NOT_COMPLETED');
      }
      return Object.freeze({requestId: candidate.requestId, view, actionResult});
    } finally {
      exactListener?.();
      await releaseListSubscription();
      if (exactSubscriptionId !== undefined) {
        const response = await input.server.request(input.sessionId, 'selector.unsubscribe', {
          subscriptionId: exactSubscriptionId,
        });
        const result = resultOf(response);
        if (!isRecord(result) || result.released !== true) {
          throw new Error('TERMINAL_AUTOMATION_REQUEST_RESULT_UNSUBSCRIBE_FAILED');
        }
      }
    }
  },
});
