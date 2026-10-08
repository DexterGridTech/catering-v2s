import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {moduleName as runtimeModuleName} from '@catering-v2s/kernel-base-runtime';
import {concatWith, defer, finalize, retry, Subject, takeUntil, throwError, timer} from 'rxjs';
import {webSocket, type WebSocketSubject} from 'rxjs/webSocket';
import {
  parseAutomationAgentConfig,
  parseAutomationBody,
  parseAutomationEnvelope,
  type AutomationAgentConfig,
  type AutomationEnvelope,
} from '../foundations/protocol';
import type {AutomationNodeRegistry} from '../foundations/registry/createAutomationNodeRegistry';
import {createControlRequestHandler} from './controlRequestHandler';
import {createRuntimeRequestHandler} from './runtimeRequestHandler';
import {createBoundedWebSocketCtor} from '../foundations/boundedWebSocketCtor';
import {moduleKind, moduleName} from '../moduleName';

export type CreateAutomationAgentModuleInput = Readonly<{
  readonly appName: string;
  readonly buildVersion: string;
  readonly config: AutomationAgentConfig;
  /** App-context identity resolved by the composition's existing DevicePort read. */
  readonly deviceIdentity: Readonly<{available: boolean; deviceId: string | null}>;
  readonly nodeRegistry: AutomationNodeRegistry;
  readonly createSessionId?: () => string;
}>;

const createSessionId = (): string => {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const reconnectDelayMs = (attempt: number): number => Math.min(500 * 2 ** Math.max(0, attempt - 1), 5000);

export const createSessionScopedSender =
  <T extends Readonly<{sessionId: string}>>(
    input: Readonly<{
      readonly sessionId: string;
      readonly socket: Readonly<{closed: boolean; next: (value: T) => void}>;
      readonly isCurrent: () => boolean;
    }>,
  ): ((reply: T) => void) =>
  reply => {
    if (reply.sessionId !== input.sessionId || !input.isCurrent() || input.socket.closed) return;
    input.socket.next(reply);
  };

const createHello = (
  input: Readonly<{
    readonly appName: string;
    readonly buildVersion: string;
    readonly sessionToken: string;
    readonly runtimeId: string;
    readonly localNodeId: string;
    readonly sessionId: string;
  }>,
): AutomationEnvelope =>
  Object.freeze({
    protocolVersion: 1,
    sessionId: input.sessionId,
    messageId: createSessionId(),
    type: 'hello',
    body: Object.freeze({
      sessionToken: input.sessionToken,
      runtimeId: input.runtimeId,
      localNodeId: input.localNodeId,
      appName: input.appName,
      buildVersion: input.buildVersion,
    }),
  });

export const createAutomationAgentModule = (input: CreateAutomationAgentModuleInput): RuntimeModule => {
  const config = parseAutomationAgentConfig(input.config);
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: [{moduleName: runtimeModuleName}],
    install: (context: RuntimeModuleContext): void => {
      if (!config.enabled) {
        context.platformPorts.logger.scope({moduleName, layer: 'ui', subsystem: 'automation-agent'}).info({
          category: 'automation.connection',
          event: 'connection.disabled',
          message: 'Automation agent is disabled for this build',
          data: {enabled: false},
        });
        return;
      }

      const logger = context.platformPorts.logger.scope({moduleName, layer: 'ui', subsystem: 'automation-agent'});
      const stop = new Subject<void>();
      let reconnectAttempt = 0;
      let activeSessionId: string | null = null;
      let activeSessionSender: ((reply: AutomationEnvelope) => void) | undefined;
      let subscription: {unsubscribe(): void} | undefined;
      let activeSocket: WebSocketSubject<AutomationEnvelope> | undefined;
      let activeOutboundQueue: ReturnType<typeof createBoundedWebSocketCtor> | undefined;
      let activeControlHandler: ReturnType<typeof createControlRequestHandler> | undefined;
      let activeRuntimeRequestHandler: ReturnType<typeof createRuntimeRequestHandler> | undefined;

      const connection = defer(() => {
        let socket: WebSocketSubject<AutomationEnvelope> | undefined;
        const sessionId = (input.createSessionId ?? createSessionId)();
        activeSessionId = sessionId;
        const outboundQueue = createBoundedWebSocketCtor(globalThis.WebSocket, boundedSocket => {
          logger.warn({
            category: 'automation.connection',
            event: 'outbound.window.limit',
            message: 'Automation WebSocket unacknowledged send window exceeded its session limit',
            data: {address: config.addressDescription, sessionId},
          });
          boundedSocket.close();
        });
        activeOutboundQueue = outboundQueue;
        socket = webSocket<AutomationEnvelope>({
          url: config.url,
          WebSocketCtor: outboundQueue.WebSocketCtor,
          serializer: message => JSON.stringify(message),
          deserializer: event => parseAutomationEnvelope(JSON.parse(String(event.data))),
          openObserver: {
            next: () => {
              reconnectAttempt = 0;
              logger.info({
                category: 'automation.connection',
                event: 'connection.opened',
                message: 'Automation WebSocket connected',
                data: {address: config.addressDescription, sessionId},
              });
              socket?.next(
                createHello({
                  appName: input.appName,
                  buildVersion: input.buildVersion,
                  sessionToken: config.sessionToken,
                  runtimeId: String(context.runtimeId),
                  localNodeId: String(context.localNodeId),
                  sessionId,
                }),
              );
            },
          },
          closeObserver: {
            next: event => {
              logger.info({
                category: 'automation.connection',
                event: 'connection.closed',
                message: 'Automation WebSocket closed',
                data: {address: config.addressDescription, sessionId, code: event.code},
              });
            },
          },
        });
        activeSocket = socket;
        const sessionSocket = socket;
        const sendForSession = createSessionScopedSender({
          sessionId,
          socket: sessionSocket,
          isCurrent: () => activeSocket === sessionSocket && activeSessionId === sessionId,
        });
        activeSessionSender = sendForSession;
        const controlHandler = createControlRequestHandler({sessionId, registry: input.nodeRegistry});
        const runtimeRequestHandler = createRuntimeRequestHandler({
          sessionId,
          context,
          deviceIdentity: input.deviceIdentity,
        });
        activeControlHandler = controlHandler;
        activeRuntimeRequestHandler = runtimeRequestHandler;
        return socket.pipe(
          concatWith(throwError(() => new Error('AUTOMATION_SOCKET_CLOSED'))),
          finalize(() => {
            controlHandler.dispose();
            runtimeRequestHandler.dispose();
            outboundQueue.dispose();
            if (activeControlHandler === controlHandler) activeControlHandler = undefined;
            if (activeRuntimeRequestHandler === runtimeRequestHandler) activeRuntimeRequestHandler = undefined;
            if (activeOutboundQueue === outboundQueue) activeOutboundQueue = undefined;
            if (activeSocket === socket) activeSocket = undefined;
            if (activeSessionSender === sendForSession) activeSessionSender = undefined;
          }),
        );
      });

      subscription = connection
        .pipe(
          retry({
            delay: () => timer(reconnectDelayMs(++reconnectAttempt)),
          }),
          // Runtime module disposal owns the complete reconnect/delay lifetime.
          // RxJS subscription teardown closes the current WebSocketSubject.
          takeUntil(stop),
        )
        .subscribe({
          next: message => {
            if (message.sessionId !== activeSessionId) return;
            if (message.type === 'ack') {
              let ackMessageId: string;
              try {
                ackMessageId = (parseAutomationBody('ack', message.body) as {ackMessageId: string}).ackMessageId;
              } catch {
                activeSocket?.complete();
                return;
              }
              activeOutboundQueue?.acknowledge(ackMessageId);
              return;
            }
            if (message.type.startsWith('controls.')) {
              if (activeSessionSender !== undefined) activeControlHandler?.handle(message, activeSessionSender);
              return;
            }
            if (
              message.type === 'runtime.info' ||
              message.type.startsWith('selector.') ||
              message.type === 'command.dispatch'
            ) {
              if (activeSessionSender !== undefined) activeRuntimeRequestHandler?.handle(message, activeSessionSender);
              return;
            }
            if (message.type === 'welcome') {
              let ackMessageId: string;
              try {
                ackMessageId = (parseAutomationBody('welcome', message.body) as {ackMessageId: string}).ackMessageId;
              } catch {
                activeSocket?.complete();
                return;
              }
              activeOutboundQueue?.acknowledge(ackMessageId);
              logger.info({
                category: 'automation.connection',
                event: 'connection.authenticated',
                message: 'Automation session authenticated',
                data: {sessionId: message.sessionId},
              });
              return;
            }
            if (message.type === 'error') {
              logger.warn({
                category: 'automation.protocol',
                event: 'server.error',
                message: 'Automation peer reported a protocol error',
                data: {sessionId: message.sessionId},
              });
            }
          },
          error: () => {
            logger.error({
              category: 'automation.connection',
              event: 'connection.failed',
              message: 'Automation connection stopped after an unrecoverable stream error',
              data: {address: config.addressDescription},
            });
          },
        });
      context.registerResource(() => {
        stop.next();
        stop.complete();
        subscription?.unsubscribe();
        activeSessionId = null;
      });
      logger.info({
        category: 'automation.connection',
        event: 'connection.starting',
        message: 'Automation connection manager started',
        data: {enabled: true, address: config.addressDescription},
      });
    },
  });
};
