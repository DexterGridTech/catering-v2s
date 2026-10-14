import {onCommand, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {selectTerminalHttpContext} from '../../../selectors/selectTerminalHttpContext';
import {moduleName} from '../../../moduleName';
import {executeTerminalHttpCommand} from '../../../declarations/commands';
import type {
  TerminalClientState,
  TerminalDataClientDependencies,
  TerminalHttpCommandPayload,
  TerminalHttpContext,
} from '../../../types/client';

export const httpProfileId = 'terminal-data-client:http';

export const isTerminalHttpRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sameTerminalHttpContext = (left: TerminalHttpContext, right: TerminalHttpContext): boolean =>
  left.credentialRevision === right.credentialRevision &&
  left.groupWorkspaceKey === right.groupWorkspaceKey &&
  left.terminalRef === right.terminalRef &&
  left.storeRef === right.storeRef &&
  left.bindingGeneration === right.bindingGeneration &&
  left.instanceMode === right.instanceMode &&
  left.selectedSpace === right.selectedSpace &&
  left.serviceName === right.serviceName &&
  left.serviceRevision === right.serviceRevision &&
  left.ready === right.ready;

const validTerminalHttpRequest = (payload: TerminalHttpCommandPayload): boolean => {
  const request = payload?.request;
  if (
    !isTerminalHttpRecord(request) ||
    !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(request.method)) ||
    typeof request.pathAndQuery !== 'string' ||
    !request.pathAndQuery.startsWith('/') ||
    request.pathAndQuery.startsWith('//') ||
    request.pathAndQuery.includes('#') ||
    typeof request.safeRetryable !== 'boolean' ||
    !isTerminalHttpRecord(request.headers) ||
    !isTerminalHttpRecord(request.body)
  )
    return false;
  const rawPath = request.pathAndQuery.split('?', 1)[0] ?? '';
  if (rawPath.includes('\\')) return false;
  let url: URL;
  try {
    url = new URL(request.pathAndQuery, 'http://terminal.local');
    if (
      rawPath.split('/').some(segment => {
        const decoded = decodeURIComponent(segment);
        return decoded === '..' || decoded === '.' || decoded.includes('/') || decoded.includes('\\');
      })
    )
      return false;
  } catch {
    return false;
  }
  if (url.origin !== 'http://terminal.local') return false;
  for (const [name, value] of Object.entries(request.headers)) {
    if (
      typeof value !== 'string' ||
      !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u.test(name) ||
      /[\r\n]/u.test(value) ||
      ['authorization', 'x-terminal-ref'].includes(name.toLowerCase())
    )
      return false;
  }
  return (
    (request.body.kind === 'empty' && Object.keys(request.body).length === 1) ||
    (request.body.kind === 'json' && Object.hasOwn(request.body, 'value'))
  );
};

type InstallTerminalHttpCommandsInput = Readonly<{
  readonly dependencies: TerminalDataClientDependencies;
  readonly readState: (state: StateRoot) => TerminalClientState;
  readonly credentialReadyForCurrentMode: (state: StateRoot, client: TerminalClientState) => boolean;
}>;

export const installTerminalHttpCommands = ({
  dependencies,
  readState,
  credentialReadyForCurrentMode,
}: InstallTerminalHttpCommandsInput) =>
  onCommand(executeTerminalHttpCommand, async (context: ActorExecutionContext) => {
    const payload = context.command.payload as TerminalHttpCommandPayload;
    const beforeRoot = context.getState();
    const before = readState(beforeRoot);
    const expected = payload?.expectedContext;
    const beforeHttpContext = selectTerminalHttpContext(beforeRoot, {serviceName: dependencies.businessServerName});
    const credential = before.credential;
    const validScope =
      expected !== undefined &&
      expected.runtimeId === context.runtimeId &&
      beforeHttpContext !== null &&
      beforeHttpContext.ready &&
      expected.scope.ready &&
      sameTerminalHttpContext(expected.scope, beforeHttpContext) &&
      credentialReadyForCurrentMode(beforeRoot, before) &&
      credential !== null;
    if (!validScope || !validTerminalHttpRequest(payload)) {
      context.platformPorts.logger
        .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-command'})
        .warn({
          category: 'terminal.http.command',
          event: 'request-rejected',
          message: 'Owner HTTP command did not match the current terminal and server configuration context',
          context: {
            commandId: context.command.commandId,
            ...(context.command.requestId == null ? {} : {requestId: context.command.requestId}),
          },
          data: {
            reason: validScope ? 'INVALID_REQUEST' : 'CONTEXT_NOT_READY',
            runtimeMatches: expected?.runtimeId === context.runtimeId,
            credentialReady: beforeHttpContext?.ready ?? false,
          },
        });
      return Object.freeze({
        kind: 'failure',
        category: 'not-delivered',
        code: validScope ? 'INVALID_TERMINAL_HTTP_REQUEST' : 'TERMINAL_HTTP_CONTEXT_NOT_READY',
      });
    }
    const headers = Object.freeze({
      ...payload.request.headers,
      Authorization: `Terminal ${credential.bindingGeneration}.${credential.credentialSecret}`,
      'X-Terminal-Ref': credential.terminalRef,
    });
    const startedAt = dependencies.now();
    const result = await dependencies.transport.executeHttp({
      profileId: httpProfileId,
      serverName: dependencies.businessServerName,
      method: payload.request.method,
      pathAndQuery: payload.request.pathAndQuery,
      headers,
      ...(payload.request.body.kind === 'empty' ? {} : {body: payload.request.body.value}),
      safeRetryable: payload.request.safeRetryable,
    });
    if (result.kind === 'failure') return result;
    const contextStillMatches = (): boolean => {
      const afterRoot = context.getState();
      const after = readState(afterRoot);
      const afterHttpContext = selectTerminalHttpContext(afterRoot, {serviceName: dependencies.businessServerName});
      const credentialStillMatches =
        after.credential !== null &&
        after.credential.terminalRef === credential.terminalRef &&
        after.credential.groupWorkspaceKey === credential.groupWorkspaceKey &&
        after.credential.storeRef === credential.storeRef &&
        after.credential.deviceId === credential.deviceId &&
        after.credential.bindingGeneration === credential.bindingGeneration &&
        after.credential.credentialSecret === credential.credentialSecret;
      return (
        afterHttpContext !== null &&
        afterHttpContext.ready &&
        sameTerminalHttpContext(expected.scope, afterHttpContext) &&
        credentialStillMatches &&
        credentialReadyForCurrentMode(afterRoot, after)
      );
    };
    if (!contextStillMatches()) {
      return Object.freeze({kind: 'failure', category: 'delivered-failure', code: 'TERMINAL_HTTP_CONTEXT_CHANGED'});
    }
    if (
      (result.status >= 200 && result.status < 300) ||
      (result.status >= 400 &&
        result.status < 500 &&
        isTerminalHttpRecord(result.body) &&
        typeof result.body.errorCode === 'string' &&
        typeof result.body.correlationId === 'string')
    ) {
      try {
        await dependencies.transport.reportHttpAddressAvailable({
          profileId: httpProfileId,
          serverName: dependencies.businessServerName,
          addressName: result.addressName,
          configRevision: result.configRevision,
        });
      } catch {
        // Address-preference bookkeeping cannot reverse an HTTP result.
      }
      if (!contextStillMatches()) {
        return Object.freeze({kind: 'failure', category: 'delivered-failure', code: 'TERMINAL_HTTP_CONTEXT_CHANGED'});
      }
    }
    context.platformPorts.logger
      .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-command'})
      .info({
        category: 'terminal.http.command',
        event: 'request-completed',
        message: 'Owner HTTP command completed through the current credential and configuration owner',
        context: {
          commandId: context.command.commandId,
          ...(context.command.requestId == null ? {} : {requestId: context.command.requestId}),
          ...(result.requestId === undefined ? {} : {transportRequestId: result.requestId}),
          ...(result.correlationId === undefined ? {} : {correlationId: result.correlationId}),
        },
        data: {
          serviceName: dependencies.businessServerName,
          addressName: result.addressName,
          configRevision: result.configRevision,
          status: result.status,
          elapsedMs: Math.max(0, dependencies.now() - startedAt),
        },
      });
    return Object.freeze({
      kind: 'response',
      status: result.status,
      body: result.body as StateJsonValue,
      ...(result.contentType === undefined ? {} : {contentType: result.contentType}),
      execution: Object.freeze({
        addressName: result.addressName,
        configRevision: result.configRevision,
        ...(result.requestId === undefined ? {} : {requestId: result.requestId}),
        ...(result.correlationId === undefined ? {} : {correlationId: result.correlationId}),
      }),
    });
  });
