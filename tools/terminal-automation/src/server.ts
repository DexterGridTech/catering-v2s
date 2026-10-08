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
  }>,
): AutomationDriverServer => {
  if (!input.token) throw new Error('TERMINAL_AUTOMATION_DRIVER_TOKEN_REQUIRED');
  const sessions = new Map<string, AutomationDriverSession>();
  const channels = new Map<string, Subject<AutomationEnvelope>>();
  const sessionListeners = new Set<() => void>();
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
          socket.close(4003, 'AUTHENTICATION_FAILED');
          return;
        }
        const hello = AutomationHelloBodySchema.parse(envelope.body);
        if (hello.sessionToken !== input.token) {
          rejectedMessages += 1;
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
          socket.close(4002, 'SESSION_ID_IN_USE');
          return;
        }
        sessions.set(session.sessionId, session);
        authenticatedSessions += 1;
        channels.set(session.sessionId, new Subject<AutomationEnvelope>());
        latestSessionId = session.sessionId;
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
        socket.close(4002, 'SESSION_MISMATCH');
        return;
      }
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
      try {
        session.socket.send(JSON.stringify(request));
      } catch {
        cancel.next();
        cancel.complete();
        void reply.catch(() => undefined);
        return Promise.reject(new Error('TERMINAL_AUTOMATION_REQUEST_SEND_FAILED'));
      }
      return reply.finally(() => cancel.complete());
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const client of server.clients) client.close(1001, 'DRIVER_SHUTDOWN');
        server.close(error => (error ? reject(error) : resolve()));
      }),
  });
};
