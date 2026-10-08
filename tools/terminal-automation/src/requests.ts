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

type RequestCandidate = Readonly<{
  readonly requestId: string;
  readonly workspace: 'MAIN' | 'BRANCH' | null;
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
): message is {
  type: 'event';
  body: SelectorListEvent | Readonly<{readonly subscriptionId: string; readonly valueState: 'NON_JSON'}>;
} =>
  message.type === 'event' &&
  isRecord(message.body) &&
  message.body.subscriptionId === subscriptionId &&
  (message.body.valueState === 'JSON' || message.body.valueState === 'NON_JSON');

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

const isRequestCandidate = (value: unknown): value is RequestCandidate =>
  isRecord(value) &&
  typeof value.requestId === 'string' &&
  (value.workspace === null || value.workspace === 'MAIN' || value.workspace === 'BRANCH');

const terminalRequestStatuses = new Set(['completed', 'partial-failed', 'timed-out', 'error']);

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
      readonly onObserverStep?: (step: string) => void;
    }>,
  ): Promise<Readonly<{readonly requestId: string; readonly view: RequestView; readonly actionResult: T}>> => {
    const timeoutMs = input.timeoutMs ?? 30_000;
    const listSubscriptionId = `request-list-${randomUUID()}`;
    const updates = new ReplaySubject<readonly RequestCandidate[]>(1);
    const candidates = new Map<string, RequestCandidate>();
    let listSubscribeRequestMessageId: string | undefined;
    let subscribePending = false;
    let earlySubscribeError: Readonly<{requestMessageId: string; code: string}> | undefined;
    let listSubscriptionReleased = false;
    let initialValueReceived = false;
    let removeSessionListener = (): void => undefined;
    const listListener = input.server.onMessage(input.sessionId, message => {
      if (message.type === 'error' && isRecord(message.body)) {
        const requestMessageId = message.body.requestMessageId;
        const code = typeof message.body.code === 'string' ? message.body.code : 'UNKNOWN';
        if (
          typeof requestMessageId === 'string' &&
          requestMessageId !== listSubscribeRequestMessageId &&
          subscribePending
        ) {
          // Runtime may send the accepted subscription response followed by an
          // initial-value error in the same socket read. Preserve only the
          // correlation metadata until the request call returns its message id.
          earlySubscribeError = Object.freeze({requestMessageId, code});
        } else if (typeof requestMessageId === 'string') {
          listSubscriptionReleased = true;
          input.onObserverStep?.('request-list.initial-value-error');
          updates.error(new Error(`TERMINAL_AUTOMATION_REQUEST_LIST_INITIAL_VALUE_FAILED code=${code}`));
        }
      }
      if (!isSelectorListEvent(message, listSubscriptionId)) return;
      if (message.body.valueState === 'NON_JSON') {
        initialValueReceived = true;
        input.onObserverStep?.('request-list.initial-value-non-json');
        updates.error(new Error('TERMINAL_AUTOMATION_REQUEST_LIST_NON_JSON'));
        return;
      }
      if (!Array.isArray(message.body.value) || !message.body.value.every(isRequestCandidate)) {
        input.onObserverStep?.('request-list.invalid-json-value');
        updates.error(new Error('TERMINAL_AUTOMATION_REQUEST_LIST_INVALID'));
        return;
      }
      input.onObserverStep?.('request-list.json-value');
      initialValueReceived = true;
      candidates.clear();
      for (const candidate of message.body.value) candidates.set(candidate.requestId, candidate);
      updates.next(Object.freeze([...candidates.values()]));
    });
    let listSubscribed = false;
    let actionStarted = false;
    let exactSubscriptionId: string | undefined;
    let exactListener: (() => void) | undefined;
    const releaseListSubscription = async (): Promise<void> => {
      if (!listSubscribed) return;
      listSubscribed = false;
      listListener();
      updates.complete();
      // Selector subscriptions belong to one automation session. The agent
      // disposes its request handler with that socket, so a missing session
      // means the subscription has already been released by session teardown.
      if (input.server.getSession(input.sessionId) === null) return;
      if (listSubscriptionReleased) return;
      const response = await input.server.request(input.sessionId, 'selector.unsubscribe', {
        subscriptionId: listSubscriptionId,
      });
      const result = resultOf(response);
      if (!isRecord(result) || result.released !== true) {
        throw new Error('TERMINAL_AUTOMATION_REQUEST_LIST_UNSUBSCRIBE_FAILED');
      }
    };
    try {
      if (input.server.getSession(input.sessionId) === null) {
        throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION');
      }
      removeSessionListener = input.server.onSessionChange(() => {
        if (actionStarted || initialValueReceived || input.server.getSession(input.sessionId) !== null) return;
        listSubscriptionReleased = true;
        input.onObserverStep?.('request-list.session-closed-before-initial-value');
        updates.error(new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION'));
      });
      if (input.server.getSession(input.sessionId) === null) {
        throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION');
      }
      input.onObserverStep?.('request-list.subscribe-start');
      subscribePending = true;
      const subscribeResponse = await input.server.request(input.sessionId, 'selector.subscribe', {
        subscriptionId: listSubscriptionId,
        selectorName: 'kernel.base.runtime.selectRequestExecutionCandidates',
        argsTuple: [input.workspace, input.commandName, input.displayMode],
      });
      subscribePending = false;
      listSubscribeRequestMessageId =
        isRecord(subscribeResponse.body) && typeof subscribeResponse.body.requestMessageId === 'string'
          ? subscribeResponse.body.requestMessageId
          : undefined;
      const accepted = resultOf(subscribeResponse);
      const isAccepted =
        isRecord(accepted) && accepted.accepted === true && accepted.subscriptionId === listSubscriptionId;
      const earlyError =
        isAccepted &&
        earlySubscribeError !== undefined &&
        earlySubscribeError.requestMessageId === listSubscribeRequestMessageId
          ? earlySubscribeError.code
          : undefined;
      earlySubscribeError = undefined;
      if (earlyError !== undefined) {
        listSubscriptionReleased = true;
        input.onObserverStep?.('request-list.initial-value-error');
        updates.error(new Error(`TERMINAL_AUTOMATION_REQUEST_LIST_INITIAL_VALUE_FAILED code=${earlyError}`));
      }
      if (!isAccepted) {
        throw new Error('TERMINAL_AUTOMATION_REQUEST_LIST_SUBSCRIBE_FAILED');
      }
      listSubscribed = true;
      input.onObserverStep?.('request-list.subscribe-accepted');
      // The Runtime selector returns only request identities whose root command
      // matches this observed action. The detailed ledger is fetched only for
      // the single identified request below.
      await firstValueFrom(updates.pipe(take(1), timeout({first: timeoutMs})));
      if (input.server.getSession(input.sessionId) === null) {
        throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION');
      }
      const baselineIds = new Set(candidates.keys());
      actionStarted = true;
      input.onObserverStep?.('request-list.initial-value-ready');
      input.onObserverStep?.('ui-action.dispatch-start');
      const actionResult = await input.action();

      // Updates remain subscribed while the real action executes, so fast completion cannot be missed.
      const findCandidate = (): RequestCandidate => {
        const matches = [...candidates.values()].filter(candidate => !baselineIds.has(candidate.requestId));
        if (matches.length > 1) throw new Error('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_AMBIGUOUS');
        if (matches.length === 0) throw new Error('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_NOT_FOUND');
        return matches[0]!;
      };
      let candidate: RequestCandidate;
      try {
        candidate = findCandidate();
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'TERMINAL_AUTOMATION_UI_ACTION_REQUEST_NOT_FOUND')
          throw error;
        await firstValueFrom(
          updates.pipe(
            filter(() => [...candidates.values()].some(candidate => !baselineIds.has(candidate.requestId))),
            take(1),
            timeout({first: timeoutMs}),
          ),
        );
        candidate = findCandidate();
      }
      input.onRequestIdentified?.(candidate.requestId);
      input.onObserverStep?.('request-list.action-identified');

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
      input.onObserverStep?.('request-result.subscribe-accepted');
      const view = await firstValueFrom(
        exactValues.pipe(
          filter(value => terminalRequestStatuses.has(value.status)),
          take(1),
          timeout({first: timeoutMs}),
        ),
      );
      input.onObserverStep?.('request-result.terminal');
      input.onRequestFinished?.(candidate.requestId);
      const root = rootCommands(view).find(command => command.commandName === input.commandName);
      if (root === undefined || (root.displayMode !== null && root.displayMode !== input.displayMode)) {
        throw new Error('TERMINAL_AUTOMATION_UI_ACTION_ROOT_COMMAND_MISMATCH');
      }
      if (view.status !== 'completed' || root.status !== 'completed' || root.errors.length !== 0) {
        throw new Error('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_NOT_COMPLETED');
      }
      return Object.freeze({requestId: candidate.requestId, view, actionResult});
    } catch (error) {
      if (!actionStarted && error instanceof Error && error.message === 'TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED') {
        throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION', {cause: error});
      }
      throw error;
    } finally {
      removeSessionListener();
      exactListener?.();
      await releaseListSubscription();
      if (exactSubscriptionId !== undefined && input.server.getSession(input.sessionId) !== null) {
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
