import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  onCommand,
  type ActorExecutionContext,
  type CommandDefinition,
} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {transportParameters} from '@catering-v2s/kernel-base-transport';
import {
  connectTerminalCommand,
  disconnectTerminalCommand,
  terminalHeartbeatTickCommand,
  terminalTransportEventCommand,
  terminalDataHeartbeatCommand,
  terminalTopicChangedCommand,
} from '../../../declarations/commands';
import {moduleName} from '../../../moduleName';
import {parseTerminalConnectionMessage, terminalConnectionMessageUtf8ByteLength} from '../../../foundations/parseTerminalConnectionMessage';
import type {RemoteCommandMessage} from '../../../generated/terminalConnectionProtocol';
import {terminalDataClientActions} from '../../slices/terminalDataClient';
import type {
  TerminalClientState,
  TerminalDataClientDependencies,
  TerminalConnectionCloseReason,
  TerminalTopicNotification,
} from '../../../types/client';
import type {TerminalDataClientSession} from './createTerminalDataClientSession';
import type {installRemoteOperationCommands} from './installRemoteOperationCommands';

export type InstallConnectionCommandsInput = Readonly<{
  readonly dependencies: TerminalDataClientDependencies;
  readonly profileId: string;
  readonly readState: (state: StateRoot) => TerminalClientState;
  readonly isHostRuntime: (state: StateRoot) => boolean;
  readonly session: TerminalDataClientSession;
  readonly remoteOperations: ReturnType<typeof installRemoteOperationCommands>;
  readonly isRecord: (value: unknown) => value is Record<string, unknown>;
  readonly isCanonicalUuid: (value: unknown) => value is string;
  readonly isRfc3339Utc: (value: unknown) => value is string;
  readonly isTerminalConnectionCloseReason: (reason: string) => reason is TerminalConnectionCloseReason;
  readonly topicSubscribeFrame: (subscription: import('../../../types/client').TerminalTopicSubscription) => string;
  readonly resetRequestId: {current?: ReturnType<typeof createRequestId>};
  readonly dispatchOfflineReset: (context: ActorExecutionContext) => void;
  readonly flush: (context: ActorExecutionContext) => Promise<void>;
}>;

export const installConnectionCommands = (input: InstallConnectionCommandsInput) => {
  const {
    dependencies,
    profileId,
    readState,
    isHostRuntime,
    session,
    remoteOperations,
    isRecord,
    isCanonicalUuid,
    isRfc3339Utc,
    isTerminalConnectionCloseReason,
    topicSubscribeFrame,
    resetRequestId,
    dispatchOfflineReset,
    flush,
  } = input;
  const reconnectPolicy = transportParameters.reconnectPolicy.defaultValue;

const dispatchBackgroundCommand = <TPayload extends StateJsonValue>(
  input: Readonly<{
    context: ActorExecutionContext;
    transport: TerminalDataClientDependencies['transport'];
    definition: CommandDefinition<TPayload>;
    payload: TPayload;
    failure: Readonly<{trigger: string; transportCause: string}>;
  }>,
): Promise<void> => {
  const {context, transport, definition, payload, failure} = input;
  const logFailure = (
    event: 'background-command-dispatch-failed' | 'background-transport-invalidation-failed',
    failureKind: string,
    dispatchStatus?: string,
  ): void => {
    context.platformPorts.logger
      .scope({
        moduleName,
        layer: 'kernel',
        subsystem: 'terminal-data-client',
        component: 'connection',
      })
      .error({
        category: 'terminal.connection.background-command',
        event,
        message: 'Terminal connection background command did not complete',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          commandName: definition.commandName,
          trigger: failure.trigger,
          failureKind,
          ...(dispatchStatus === undefined ? {} : {dispatchStatus}),
        },
      });
  };
  const invalidateTransport = async (failureKind: string, dispatchStatus?: string): Promise<void> => {
    logFailure('background-command-dispatch-failed', failureKind, dispatchStatus);
    try {
      await transport.invalid({profileId, cause: failure.transportCause});
    } catch {
      logFailure('background-transport-invalidation-failed', 'transport-invalidation-rejected');
    }
  };

  try {
    return context.dispatchCommand(definition, payload).then(
      result =>
        result.status === 'completed' ? undefined : invalidateTransport('dispatch-result-not-completed', result.status),
      () => invalidateTransport('dispatch-rejected'),
    );
  } catch {
    return invalidateTransport('dispatch-threw');
  }
};

  const clearHeartbeatDeadline = (): void => {
    if (session.heartbeatDeadline !== undefined) clearTimeout(session.heartbeatDeadline);
    session.heartbeatDeadline = undefined;
  };

  const armHeartbeatDeadline = (context: ActorExecutionContext): void => {
    clearHeartbeatDeadline();
    session.heartbeatDeadline = setTimeout(
      () =>
        dispatchBackgroundCommand({
          context,
          transport: dependencies.transport,
          definition: terminalTransportEventCommand,
          payload: {event: {type: 'close', code: 4000, reason: 'HEARTBEAT_TIMEOUT'}},
          failure: {trigger: 'heartbeat-deadline', transportCause: 'HEARTBEAT_TIMEOUT'},
        }),
      session.expectedHeartbeatTimeoutMs,
    );
  };

  const clearLocalConnection = (): void => {
    session.connectionGeneration += 1;
    if (session.heartbeatTimer !== undefined) clearInterval(session.heartbeatTimer);
    clearHeartbeatDeadline();
    session.heartbeatTimer = undefined;
    session.sentAtBySequence.clear();
    session.sessionReady = false;
    session.activeSessionId = null;
    session.unsubscribeConnection?.();
    session.unsubscribeConnection = undefined;
    session.connection = undefined;
  };

  const closeLocalConnection = async (): Promise<void> => {
    clearLocalConnection();
    await dependencies.transport.stop({profileId});
  };

  const sendCurrentTopicSubscriptions = async (context: ActorExecutionContext): Promise<boolean> => {
    if (!session.sessionReady || session.connection === undefined) return false;
    const subscriptions = Object.values(readState(context.getState()).topicSubscriptions);
    for (const subscription of subscriptions) {
      try {
        await session.connection.send(topicSubscribeFrame(subscription));
      } catch {
        await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
        return false;
      }
    }
    return true;
  };


  const dispose = (): void => {
    if (session.heartbeatTimer !== undefined) clearInterval(session.heartbeatTimer);
    clearHeartbeatDeadline();
    session.heartbeatTimer = undefined;
    session.unsubscribeConnection?.();
    session.unsubscribeConnection = undefined;
    session.connection = undefined;
    session.sessionReady = false;
    session.sentAtBySequence.clear();
  };

  return Object.freeze({
    commands: Object.freeze([
    onCommand(connectTerminalCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      const credential = readState(context.getState()).credential;
      if (credential === null) return Object.freeze({status: 'rejected', reason: 'TERMINAL_NOT_ACTIVE'});
      const clientState = readState(context.getState());
      if (clientState.activationStatus === 'cancelling')
        return Object.freeze({status: 'rejected', reason: 'CANCELLATION_IN_PROGRESS'});
      if (dependencies.canActivate?.(context.getState()) === false)
        return Object.freeze({status: 'rejected', reason: 'TOPOLOGY_CHANGE_IN_PROGRESS'});
      if (clientState.connection.status === 'connecting') return Object.freeze({status: 'connecting'});
      if (clientState.connection.status === 'awaiting-ready' || clientState.connection.status === 'connected')
        return Object.freeze({status: clientState.connection.status});
      if (clientState.connection.status === 'backoff') clearLocalConnection();
      context.dispatchAction(
        terminalDataClientActions.setConnection(
          Object.freeze({
            status: 'connecting',
            addressName: null,
            nodeId: null,
            sessionId: null,
            lastCloseReason: null,
          }),
        ),
      );
      try {
        const opened = await dependencies.transport.start({
          profileId,
          serverName: 'terminal-data-server',
          endpointPathAndQuery: `/tdp/${encodeURIComponent(credential.groupWorkspaceKey)}/ws`,
          reconnectPolicy,
        });
        session.connection = opened;
        if (
          !isHostRuntime(context.getState()) ||
          readState(context.getState()).activationStatus === 'cancelling' ||
          readState(context.getState()).credential !== credential ||
          dependencies.canActivate?.(context.getState()) === false
        ) {
          await closeLocalConnection();
          return Object.freeze({status: 'rejected', reason: 'CONNECTION_RESULT_STALE'});
        }
        session.sessionReady = false;
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'awaiting-ready',
              addressName: null,
              nodeId: null,
              sessionId: null,
              lastCloseReason: null,
            }),
          ),
        );
        session.unsubscribeConnection = opened.subscribe(event =>
          dispatchBackgroundCommand({
            context,
            transport: dependencies.transport,
            definition: terminalTransportEventCommand,
            payload: {event},
            failure: {trigger: `websocket-${event.type}`, transportCause: 'NETWORK_ERROR'},
          }),
        );
        return Object.freeze({status: 'awaiting-ready'});
      } catch {
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'backoff',
              addressName: null,
              nodeId: null,
              sessionId: null,
              lastCloseReason: 'NETWORK_ERROR',
            }),
          ),
        );
        await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
        return Object.freeze({status: 'connect-failed'});
      }
    }),
    onCommand(disconnectTerminalCommand, async context => {
      context.dispatchAction(terminalDataClientActions.clearPendingTopicNotifications());
      await closeLocalConnection();
      context.dispatchAction(terminalDataClientActions.clearConnection());
      return Object.freeze({status: 'disconnected'});
    }),
    onCommand(terminalTransportEventCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const event = context.command.payload.event;
      if (readState(context.getState()).activationStatus === 'cancelling') {
        if (event.type === 'open') await dependencies.transport.stop({profileId});
        return Object.freeze({status: 'cancellation-in-progress'});
      }
      if (event.type === 'message') {
        let parsed: unknown;
        try {
          parsed = parseTerminalConnectionMessage(event.raw);
        } catch {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
          return null;
        }
        if (!isRecord(parsed) || typeof parsed.type !== 'string') {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
          return null;
        }
        if (!session.sessionReady) {
          if (
            parsed.type !== 'SESSION_READY' ||
            typeof parsed.sessionId !== 'string' ||
            terminalConnectionMessageUtf8ByteLength(parsed.sessionId) < 1 ||
            terminalConnectionMessageUtf8ByteLength(parsed.sessionId) > 128 ||
            typeof parsed.nodeId !== 'string' ||
            terminalConnectionMessageUtf8ByteLength(parsed.nodeId) < 1 ||
            terminalConnectionMessageUtf8ByteLength(parsed.nodeId) > 128 ||
            !isRfc3339Utc(parsed.serverTime) ||
            !Number.isSafeInteger(parsed.heartbeatIntervalMs) ||
            Number(parsed.heartbeatIntervalMs) < 1_000 ||
            !Number.isSafeInteger(parsed.heartbeatTimeoutMs) ||
            Number(parsed.heartbeatTimeoutMs) < Number(parsed.heartbeatIntervalMs) * 2
          ) {
            await dependencies.transport.invalid({profileId, cause: 'SESSION_READY_INVALID'});
            return null;
          }
          session.sessionReady = true;
          session.activeSessionId = parsed.sessionId;
          session.expectedHeartbeatTimeoutMs = Number(parsed.heartbeatTimeoutMs);
          context.dispatchAction(
            terminalDataClientActions.sessionReady({
              sessionId: parsed.sessionId,
              nodeId: parsed.nodeId,
              heartbeatIntervalMs: Number(parsed.heartbeatIntervalMs),
              observedAt: dependencies.now(),
            }),
          );
          await dependencies.transport.ready({profileId, stableAfterMs: Number(parsed.heartbeatIntervalMs)});
          if (!(await sendCurrentTopicSubscriptions(context))) return null;
          await remoteOperations.resumeRemoteReports(context);
          if (session.heartbeatTimer !== undefined) clearInterval(session.heartbeatTimer);
          session.heartbeatTimer = setInterval(
            () =>
              dispatchBackgroundCommand({
                context,
                transport: dependencies.transport,
                definition: terminalHeartbeatTickCommand,
                payload: {},
                failure: {trigger: 'heartbeat-interval', transportCause: 'NETWORK_ERROR'},
              }),
            Number(parsed.heartbeatIntervalMs),
          );
          return Object.freeze({status: 'ready'});
        }
        if (parsed.type === 'SESSION_READY') {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
          return null;
        }
        if (parsed.type === 'REMOTE_COMMAND') {
          if (
            !isCanonicalUuid(parsed.remoteOperationId) ||
            !isCanonicalUuid(parsed.requestId) ||
            !Number.isSafeInteger(parsed.bindingGeneration) ||
            Number(parsed.bindingGeneration) < 1 ||
            typeof parsed.commandName !== 'string' ||
            terminalConnectionMessageUtf8ByteLength(parsed.commandName) < 1 ||
            terminalConnectionMessageUtf8ByteLength(parsed.commandName) > 128 ||
            !isRecord(parsed.parameters)
          ) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          return remoteOperations.runRemoteCommand(context, parsed as unknown as RemoteCommandMessage);
        }
        if (parsed.type === 'REMOTE_REPORT_ACK') {
          if (
            !isCanonicalUuid(parsed.reportId) ||
            !isCanonicalUuid(parsed.remoteOperationId) ||
            !isCanonicalUuid(parsed.requestId) ||
            !isRfc3339Utc(parsed.acceptedAt)
          ) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const fact = readState(context.getState()).remoteOperations[parsed.remoteOperationId];
          if (fact === undefined || fact.reportId !== parsed.reportId || fact.requestId !== parsed.requestId)
            return Object.freeze({status: 'stale-remote-report-ack'});
          if (fact.phase === 'COMPLETED' || fact.phase === 'FAILED') {
            const removed = await remoteOperations.persistRemoteRemoval(context, fact);
            return Object.freeze({status: removed ? 'remote-report-released' : 'remote-report-release-failed'});
          }
          return Object.freeze({status: 'remote-report-acknowledged'});
        }
        if (parsed.type === 'PONG') {
          if (!Number.isSafeInteger(parsed.seq) || Number(parsed.seq) < 1 || !isRfc3339Utc(parsed.serverTs)) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const sentAt = session.sentAtBySequence.get(Number(parsed.seq));
          if (sentAt === undefined) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          session.sentAtBySequence.delete(Number(parsed.seq));
          const observedAt = dependencies.now();
          const rttMs = Math.max(0, observedAt - sentAt);
          armHeartbeatDeadline(context);
          context.dispatchAction(terminalDataClientActions.recordRtt({rttMs, observedAt}));
          context.platformPorts.logger
            .scope({
              moduleName,
              layer: 'kernel',
              subsystem: 'terminal-data-client',
              component: 'connection',
            })
            .info({
              category: 'terminal.connection.heartbeat',
              event: 'heartbeat-pong-matched',
              message: 'Matched TDS PONG and recorded connection round-trip time',
              context: {commandId: context.command.commandId},
              data: {profileId, sequence: Number(parsed.seq), rttMs},
            });
          const credential = readState(context.getState()).credential;
          if (credential !== null && session.activeSessionId !== null) {
            void context
              .dispatchCommand(
                terminalDataHeartbeatCommand,
                Object.freeze({
                  bindingGeneration: credential.bindingGeneration,
                  sessionId: session.activeSessionId,
                  sequence: Number(parsed.seq),
                  observedAt,
                  rttMs,
                }),
                {requestId: context.command.requestId ?? createRequestId()},
              )
              .then(result => {
                const completedConsumer = result.actorResults.find(item => item.status === 'completed');
                const consumerResult = completedConsumer?.result;
                const resultStatus =
                  typeof consumerResult === 'object' &&
                  consumerResult !== null &&
                  'status' in consumerResult &&
                  typeof consumerResult.status === 'string'
                    ? consumerResult.status
                    : 'UNKNOWN';
                context.platformPorts.logger
                  .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
                  .info({
                    category: 'terminal.connection.heartbeat',
                    event: 'heartbeat-consumer-completed',
                    message: 'Observed local consumers after a valid PONG; no business payload is logged',
                    context: {commandId: context.command.commandId},
                    data: {
                      dispatchStatus: result.status,
                      consumerCount: result.actorResults.length,
                      actorStatus: completedConsumer?.status ?? result.actorResults[0]?.status ?? 'NONE',
                      resultStatus,
                    },
                  });
                if (result.status === 'completed') return;
                context.platformPorts.logger
                  .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
                  .warn({
                    category: 'terminal.connection.heartbeat',
                    event: 'heartbeat-consumer-not-completed',
                    message: 'A local heartbeat consumer did not complete; connection health remains unchanged',
                    context: {commandId: context.command.commandId},
                    data: {dispatchStatus: result.status},
                  });
              })
              .catch(error => {
                const rawCode = isRecord(error) ? error.code : undefined;
                const failureCode =
                  typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{1,95}$/u.test(rawCode)
                    ? rawCode
                    : 'LOCAL_CONSUMER_REJECTED';
                context.platformPorts.logger
                  .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
                  .warn({
                    category: 'terminal.connection.heartbeat',
                    event: 'heartbeat-consumer-rejected',
                    message: 'A local heartbeat consumer rejected; connection health remains unchanged',
                    context: {commandId: context.command.commandId},
                    data: {code: failureCode},
                  });
              });
          }
        }
        if (parsed.type === 'TOPIC_CHANGED') {
          if (
            !isCanonicalUuid(parsed.notificationId) ||
            !isCanonicalUuid(parsed.subscriptionId) ||
            typeof parsed.topicKey !== 'string' ||
            !isCanonicalUuid(parsed.ownerRef) ||
            !Number.isSafeInteger(parsed.topicTimeEpochMillis) ||
            Number(parsed.topicTimeEpochMillis) < 0
          ) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const current = readState(context.getState());
          const subscription = current.topicSubscriptions[parsed.subscriptionId];
          if (subscription === undefined) return Object.freeze({status: 'stale-topic-notification'});
          if (subscription.topicKey !== parsed.topicKey || subscription.ownerRef !== parsed.ownerRef) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const notification: TerminalTopicNotification = Object.freeze({
            notificationId: parsed.notificationId,
            subscriptionId: parsed.subscriptionId,
            topicKey: subscription.topicKey,
            ownerRef: subscription.ownerRef,
            topicTimeEpochMillis: Number(parsed.topicTimeEpochMillis),
          });
          context.dispatchAction(
            terminalDataClientActions.setPendingTopicNotification({
              subscriptionId: subscription.subscriptionId,
              notification,
            }),
          );
          const credential = current.credential;
          if (credential === null) return Object.freeze({status: 'stale-topic-binding'});
          const dispatched = await context.dispatchCommand(
            terminalTopicChangedCommand,
            {
              subscriberKey: subscription.subscriberKey,
              terminalRef: credential.terminalRef,
              bindingGeneration: credential.bindingGeneration,
              notification,
            },
            {requestId: context.command.requestId ?? createRequestId()},
          );
          return Object.freeze({status: 'topic-notification-dispatched', dispatchStatus: dispatched.status});
        }
        if (parsed.type === 'AUTHENTICATE' || parsed.type === 'PING') {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
        }
        return null;
      }
      if (event.type === 'open') {
        session.connectionGeneration += 1;
        const persistedRemoteOperations = Object.values(readState(context.getState()).remoteOperations);
        const nextRevision = event.configRevision ?? null;
        const hasStaleRemoteOperation = persistedRemoteOperations.some(
          fact => fact.configRevision !== nextRevision || fact.addressName !== (event.addressName ?? null),
        );
        session.currentConfigRevision = nextRevision;
        if (hasStaleRemoteOperation) {
          session.remoteOperationEpoch += 1;
          context.dispatchAction(terminalDataClientActions.clearRemoteOperations());
          let persistenceFailed = false;
          try {
            await flush(context);
          } catch {
            persistenceFailed = true;
          }
          if (persistenceFailed) {
            await remoteOperations.restoreRemoteOperations(context, persistedRemoteOperations);
            await dependencies.transport.invalid({profileId, cause: 'PERSISTENCE_FAILED'});
            return Object.freeze({status: 'remote-operation-clear-failed'});
          }
          session.lateRemoteResults.clear();
        }
        context.dispatchAction(terminalDataClientActions.clearPendingTopicNotifications());
        if (session.heartbeatTimer !== undefined) clearInterval(session.heartbeatTimer);
        clearHeartbeatDeadline();
        session.heartbeatTimer = undefined;
        session.sentAtBySequence.clear();
        session.sessionReady = false;
        session.activeSessionId = null;
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'awaiting-ready',
              addressName: event.addressName ?? null,
              nodeId: null,
              sessionId: null,
              lastCloseReason: null,
            }),
          ),
        );
        const credential = readState(context.getState()).credential;
        if (credential !== null && session.connection !== undefined) {
          const frame = {
            type: 'AUTHENTICATE',
            terminalRef: credential.terminalRef,
            terminalCredential: `${credential.bindingGeneration}.${credential.credentialSecret}`,
            deviceId: credential.deviceId,
            appVersion: dependencies.appVersion,
          };
          try {
            await session.connection.send(JSON.stringify(frame));
          } catch {
            await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
          }
        }
        return null;
      }
      if (event.type === 'close' || event.type === 'error') {
        session.connectionGeneration += 1;
        context.dispatchAction(terminalDataClientActions.clearPendingTopicNotifications());
        if (session.heartbeatTimer !== undefined) clearInterval(session.heartbeatTimer);
        clearHeartbeatDeadline();
        session.heartbeatTimer = undefined;
        session.sentAtBySequence.clear();
        session.sessionReady = false;
        session.activeSessionId = null;
        const reason: TerminalConnectionCloseReason =
          event.type === 'error'
            ? 'NETWORK_ERROR'
            : event.code === 4000 && event.reason !== undefined && isTerminalConnectionCloseReason(event.reason)
              ? event.reason
              : 'UNKNOWN';
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'backoff',
              addressName: readState(context.getState()).connection.addressName,
              nodeId: null,
              sessionId: null,
              lastCloseReason: reason,
            }),
          ),
        );
        if (reason === 'ACTIVATION_CANCELLED') {
          context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
          await closeLocalConnection();
          resetRequestId.current = context.command.requestId ?? createRequestId();
          dispatchOfflineReset(context);
        } else {
          await dependencies.transport.invalid({profileId, cause: reason});
        }
        return null;
      }
      return null;
    }),
    onCommand(terminalHeartbeatTickCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      if (readState(context.getState()).activationStatus === 'cancelling')
        return Object.freeze({status: 'cancellation-in-progress'});
      if (!session.sessionReady || session.connection === undefined) return null;
      const current = readState(context.getState());
      const seq = current.nextPingSequence;
      const sentAt = dependencies.now();
      const raw = JSON.stringify({
        type: 'PING',
        seq,
        clientTs: new Date(sentAt).toISOString(),
        lastRttMs: current.lastRttMs,
      });
      await session.connection.send(raw);
      session.sentAtBySequence.set(seq, sentAt);
      context.dispatchAction(terminalDataClientActions.nextPing());
      if (session.heartbeatDeadline === undefined) armHeartbeatDeadline(context);
      return Object.freeze({status: 'ping-sent', seq});
    }),

    ]),
    clearLocalConnection,
    closeLocalConnection,
    clearHeartbeatDeadline,
    dispose,
  });
};
