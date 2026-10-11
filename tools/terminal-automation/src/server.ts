import {randomUUID} from 'node:crypto';
import {filter, firstValueFrom, Subject, take, takeUntil, timeout} from 'rxjs';
import {WebSocketServer, type WebSocket} from 'ws';
import {
  AutomationHelloBodySchema,
  parseAutomationDriverRequest,
  parseAutomationEnvelope,
  type AutomationEnvelope,
  type AutomationDriverRequestType,
} from '@catering-v2s/ui-base-automation-agent/protocol';

export type AutomationDriverSession = Readonly<{
  readonly sessionId: string;
  readonly runtimeId: string;
  readonly localNodeId: string;
  readonly appName: string;
  readonly buildVersion: string;
  readonly socket: WebSocket;
}>;

export type AutomationDriverDiagnostics = Readonly<{
  readonly socketConnections: number;
  readonly authenticatedSessions: number;
  readonly authenticationTimeouts: number;
  readonly rejectedMessages: number;
  readonly activeSockets: number;
  readonly activeSessions: number;
}>;

export type AutomationDriverTrace = Readonly<{
  readonly at: string;
  readonly runId?: string;
  readonly event: string;
  readonly sessionId?: string;
  readonly messageId?: string;
  readonly requestMessageId?: string;
  readonly messageType?: string;
  readonly commandId?: string;
  readonly commandName?: string;
  readonly selectorName?: string;
  readonly subscriptionId?: string;
  readonly sequence?: number;
  readonly requestId?: string;
  readonly appName?: string;
  readonly buildVersion?: string;
  readonly runtimeId?: string;
  readonly actorKey?: string;
  readonly actorStatus?: string;
  readonly runtimeEventKind?: string;
  readonly selectorValueState?: 'JSON' | 'NON_JSON';
  readonly selectorReason?: string;
  readonly failureCode?: string;
  readonly elapsedMs?: number;
}>;

export type AutomationDriverServer = Readonly<{
  readonly server: WebSocketServer;
  readonly getSession: (sessionId?: string) => AutomationDriverSession | null;
  readonly getSessions: () => readonly AutomationDriverSession[];
  readonly getDiagnostics: () => AutomationDriverDiagnostics;
  readonly onSessionChange: (listener: () => void) => () => void;
  readonly onMessage: (sessionId: string, listener: (message: AutomationEnvelope) => void) => () => void;
  readonly request: (
    sessionId: string,
    type: AutomationDriverRequestType,
    body: unknown,
    timeoutMs?: number,
  ) => Promise<AutomationEnvelope>;
  readonly close: () => Promise<void>;
}>;

const isHello = (message: AutomationEnvelope): boolean => {
  return message.type === 'hello' && AutomationHelloBodySchema.safeParse(message.body).success;
};

const isRequestReply = (message: AutomationEnvelope, requestMessageId: string): boolean => {
  if (message.type !== 'response' && message.type !== 'error') return false;
  if (typeof message.body !== 'object' || message.body === null) return false;
  return (message.body as Record<string, unknown>).requestMessageId === requestMessageId;
};

export const createAutomationDriverServer = (
  input: Readonly<{
    readonly token: string;
    readonly host?: string;
    readonly port?: number;
    readonly path?: string;
    readonly onSession?: (session: AutomationDriverSession | null) => void;
    readonly onDiagnostic?: (trace: AutomationDriverTrace) => void;
  }>,
): AutomationDriverServer => {
  if (!input.token) throw new Error('TERMINAL_AUTOMATION_DRIVER_TOKEN_REQUIRED');
  const sessions = new Map<string, AutomationDriverSession>();
  const channels = new Map<string, Subject<AutomationEnvelope>>();
  const sessionListeners = new Set<() => void>();
  const runId = process.env.TERMINAL_AUTOMATION_RUN_ID;
  const trace = (event: string, fields: Omit<AutomationDriverTrace, 'at' | 'runId' | 'event'> = {}): void => {
    const entry: AutomationDriverTrace = Object.freeze({
      at: new Date().toISOString(),
      ...(runId !== undefined && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(runId) ? {runId} : {}),
      event,
      ...fields,
    });
    try {
      if (input.onDiagnostic !== undefined) input.onDiagnostic(entry);
      else if (runId !== undefined) process.stdout.write(`TERMINAL_AUTOMATION_DRIVER ${JSON.stringify(entry)}\n`);
    } catch {
      // Diagnostics must never change the request or cleanup outcome.
    }
  };
  let latestSessionId: string | null = null;
  let socketConnections = 0;
  let authenticatedSessions = 0;
  let authenticationTimeouts = 0;
  let rejectedMessages = 0;
  let activeSockets = 0;
  const server = new WebSocketServer({
    host: input.host ?? '127.0.0.1',
    port: input.port ?? 19090,
    path: input.path ?? '/automation',
    maxPayload: 1024 * 1024,
    perMessageDeflate: false,
  });
  server.on('connection', socket => {
    socketConnections += 1;
    activeSockets += 1;
    let authenticated = false;
    let session: AutomationDriverSession | null = null;
    trace('socket.accepted');
    const authTimer = setTimeout(() => {
      if (!authenticated) {
        authenticationTimeouts += 1;
        socket.close(4001, 'AUTHENTICATION_TIMEOUT');
      }
    }, 5_000);
    socket.on('message', (data, isBinary) => {
      if (isBinary) {
        rejectedMessages += 1;
        socket.close(1003, 'TEXT_REQUIRED');
        return;
      }
      let envelope: AutomationEnvelope;
      try {
        envelope = parseAutomationEnvelope(JSON.parse(data.toString('utf8')));
      } catch {
        rejectedMessages += 1;
        socket.close(1002, 'INVALID_ENVELOPE');
        return;
      }
      if (!authenticated) {
        if (!isHello(envelope)) {
          rejectedMessages += 1;
          trace('message.rejected', {
            messageId: envelope.messageId,
            messageType: envelope.type,
            failureCode: 'HELLO_REQUIRED',
          });
          socket.close(4003, 'AUTHENTICATION_FAILED');
          return;
        }
        const hello = AutomationHelloBodySchema.parse(envelope.body);
        if (hello.sessionToken !== input.token) {
          rejectedMessages += 1;
          trace('authentication.rejected', {
            sessionId: envelope.sessionId,
            messageId: envelope.messageId,
            messageType: 'hello',
            appName: hello.appName,
            buildVersion: hello.buildVersion,
            failureCode: 'AUTHENTICATION_FAILED',
          });
          socket.close(4003, 'AUTHENTICATION_FAILED');
          return;
        }
        clearTimeout(authTimer);
        authenticated = true;
        session = Object.freeze({
          sessionId: envelope.sessionId,
          runtimeId: hello.runtimeId,
          localNodeId: hello.localNodeId,
          appName: hello.appName,
          buildVersion: hello.buildVersion,
          socket,
        });
        if (sessions.has(session.sessionId)) {
          trace('authentication.rejected', {
            sessionId: session.sessionId,
            messageId: envelope.messageId,
            messageType: 'hello',
            appName: session.appName,
            buildVersion: session.buildVersion,
            failureCode: 'SESSION_ID_IN_USE',
          });
          socket.close(4002, 'SESSION_ID_IN_USE');
          return;
        }
        sessions.set(session.sessionId, session);
        authenticatedSessions += 1;
        channels.set(session.sessionId, new Subject<AutomationEnvelope>());
        latestSessionId = session.sessionId;
        trace('session.authenticated', {
          sessionId: session.sessionId,
          messageId: envelope.messageId,
          messageType: 'hello',
          appName: session.appName,
          buildVersion: session.buildVersion,
          runtimeId: session.runtimeId,
        });
        input.onSession?.(session);
        for (const listener of [...sessionListeners]) listener();
        const welcome: AutomationEnvelope = Object.freeze({
          protocolVersion: 1,
          sessionId: envelope.sessionId,
          messageId: `welcome-${randomUUID()}`,
          type: 'welcome',
          body: Object.freeze({accepted: true, ackMessageId: envelope.messageId}),
        });
        socket.send(JSON.stringify(welcome));
        return;
      }
      if (envelope.sessionId !== session?.sessionId) {
        rejectedMessages += 1;
        trace('message.rejected', {
          sessionId: session?.sessionId,
          messageId: envelope.messageId,
          messageType: envelope.type,
          failureCode: 'SESSION_MISMATCH',
        });
        socket.close(4002, 'SESSION_MISMATCH');
        return;
      }
      if (envelope.type === 'event') traceRuntimeEvent(envelope, trace);
      else if (envelope.type === 'response' || envelope.type === 'error') traceReply(envelope, trace);
      channels.get(session.sessionId)?.next(envelope);
      const acknowledgement: AutomationEnvelope = Object.freeze({
        protocolVersion: 1,
        sessionId: session.sessionId,
        messageId: `ack-${randomUUID()}`,
        type: 'ack',
        body: Object.freeze({ackMessageId: envelope.messageId}),
      });
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(acknowledgement));
    });
    socket.on('close', () => {
      activeSockets = Math.max(0, activeSockets - 1);
      clearTimeout(authTimer);
      trace('socket.closed', {sessionId: session?.sessionId});
      if (session === null || sessions.get(session.sessionId)?.socket !== socket) return;
      sessions.delete(session.sessionId);
      const channel = channels.get(session.sessionId);
      channel?.complete();
      channels.delete(session.sessionId);
      if (latestSessionId === session.sessionId) latestSessionId = sessions.keys().next().value ?? null;
      input.onSession?.(latestSessionId === null ? null : (sessions.get(latestSessionId) ?? null));
      for (const listener of [...sessionListeners]) listener();
    });
    socket.on('error', () => {
      // The managed driver records socket lifecycle through its owning run logger.
    });
  });
  return Object.freeze({
    server,
    getSession: (sessionId?: string) =>
      sessionId === undefined ? (sessions.get(latestSessionId ?? '') ?? null) : (sessions.get(sessionId) ?? null),
    getSessions: () => Object.freeze([...sessions.values()]),
    getDiagnostics: () =>
      Object.freeze({
        socketConnections,
        authenticatedSessions,
        authenticationTimeouts,
        rejectedMessages,
        activeSockets,
        activeSessions: sessions.size,
      }),
    onSessionChange: listener => {
      sessionListeners.add(listener);
      return () => sessionListeners.delete(listener);
    },
    onMessage: (sessionId, listener) => {
      const channel = channels.get(sessionId);
      if (channel === undefined) throw new Error('TERMINAL_AUTOMATION_SESSION_NOT_FOUND');
      const subscription = channel.subscribe(listener);
      return () => subscription.unsubscribe();
    },
    request: (sessionId, type, body, timeoutMs = 5_000) => {
      let parsedBody: unknown;
      try {
        parsedBody = parseAutomationDriverRequest(type, body);
      } catch {
        return Promise.reject(new Error(`TERMINAL_AUTOMATION_REQUEST_BODY_INVALID:${type}`));
      }
      const session = sessions.get(sessionId);
      const channel = channels.get(sessionId);
      if (session === undefined || channel === undefined || session.socket.readyState !== session.socket.OPEN) {
        return Promise.reject(new Error('TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED'));
      }
      const messageId = randomUUID();
      const startedAt = Date.now();
      const cancel = new Subject<void>();
      const reply = firstValueFrom(
        channel.pipe(
          filter(message => isRequestReply(message, messageId)),
          take(1),
          timeout({first: timeoutMs}),
          takeUntil(cancel),
        ),
      );
      const request: AutomationEnvelope = Object.freeze({
        protocolVersion: 1,
        sessionId,
        messageId,
        type,
        body: parsedBody,
      });
      trace('request.started', {
        sessionId,
        messageId,
        messageType: type,
        ...traceRequestBody(type, parsedBody),
      });
      try {
        session.socket.send(JSON.stringify(request));
      } catch {
        cancel.next();
        cancel.complete();
        void reply.catch(() => undefined);
        trace('request.failed', {sessionId, messageId, messageType: type, failureCode: 'REQUEST_SEND_FAILED'});
        return Promise.reject(new Error('TERMINAL_AUTOMATION_REQUEST_SEND_FAILED'));
      }
      return reply
        .then(
          value => {
            trace('request.completed', {
              sessionId,
              messageId,
              messageType: type,
              elapsedMs: Date.now() - startedAt,
            });
            return value;
          },
          error => {
            trace('request.failed', {
              sessionId,
              messageId,
              messageType: type,
              elapsedMs: Date.now() - startedAt,
              failureCode:
                error instanceof Error && /^(TimeoutError|EmptyError)$/u.test(error.name)
                  ? error.name.toUpperCase()
                  : 'REQUEST_REPLY_FAILED',
            });
            throw error;
          },
        )
        .finally(() => cancel.complete());
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const client of server.clients) client.close(1001, 'DRIVER_SHUTDOWN');
        server.close(error => (error ? reject(error) : resolve()));
      }),
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeTraceId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/u.test(value);

const traceRequestBody = (
  type: AutomationDriverRequestType,
  body: unknown,
): Pick<AutomationDriverTrace, 'commandName' | 'selectorName' | 'requestId'> => {
  if (!isRecord(body)) return {};
  if (type === 'command.dispatch') {
    return {
      ...(safeTraceId(body.commandName) ? {commandName: body.commandName} : {}),
      ...(safeTraceId(body.requestId) ? {requestId: body.requestId} : {}),
    };
  }
  if (type.startsWith('selector.')) {
    return safeTraceId(body.selectorName) ? {selectorName: body.selectorName} : {};
  }
  return {};
};

const traceRuntimeEvent = (
  message: AutomationEnvelope,
  trace: (event: string, fields?: Omit<AutomationDriverTrace, 'at' | 'runId' | 'event'>) => void,
): void => {
  if (!isRecord(message.body)) return;
  const body = message.body;
  const runtimeEvent = isRecord(body.event) ? body.event : undefined;
  const valueState = body.valueState === 'JSON' || body.valueState === 'NON_JSON' ? body.valueState : undefined;
  const reason = typeof body.reason === 'string' ? body.reason.match(/^([A-Z][A-Z0-9_]*)/u)?.[1] : undefined;
  trace('runtime.event', {
    ...(safeTraceId(body.requestId) ? {requestId: body.requestId} : {}),
    ...(safeTraceId(body.kind) ? {messageType: body.kind} : {}),
    ...(safeTraceId(body.selectorName) ? {selectorName: body.selectorName} : {}),
    ...(safeTraceId(body.subscriptionId) ? {subscriptionId: body.subscriptionId} : {}),
    ...(typeof body.sequence === 'number' && Number.isSafeInteger(body.sequence) && body.sequence >= 0
      ? {sequence: body.sequence}
      : {}),
    ...(runtimeEvent !== undefined && safeTraceId(runtimeEvent.kind) ? {runtimeEventKind: runtimeEvent.kind} : {}),
    ...(runtimeEvent !== undefined && safeTraceId(runtimeEvent.commandId) ? {commandId: runtimeEvent.commandId} : {}),
    ...(runtimeEvent !== undefined && safeTraceId(runtimeEvent.actorKey) ? {actorKey: runtimeEvent.actorKey} : {}),
    ...(runtimeEvent !== undefined && safeTraceId(runtimeEvent.status) ? {actorStatus: runtimeEvent.status} : {}),
    ...(valueState === undefined ? {} : {selectorValueState: valueState}),
    ...(valueState === 'NON_JSON' && reason !== undefined ? {selectorReason: reason} : {}),
  });
};

const traceReply = (
  message: AutomationEnvelope,
  trace: (event: string, fields?: Omit<AutomationDriverTrace, 'at' | 'runId' | 'event'>) => void,
): void => {
  if (!isRecord(message.body)) return;
  const body = message.body;
  const error = isRecord(body.error) ? body.error : undefined;
  const code = typeof body.code === 'string' ? body.code : error?.code;
  trace(message.type === 'error' ? 'runtime.request.error' : 'runtime.request.response', {
    messageId: message.messageId,
    messageType: message.type,
    ...(safeTraceId(body.requestMessageId) ? {requestMessageId: body.requestMessageId} : {}),
    ...(typeof code === 'string' && /^[A-Z][A-Z0-9_:-]{0,100}$/u.test(code) ? {failureCode: code} : {}),
  });
};
