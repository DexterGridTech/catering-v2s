import {onCommand, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {
  acceptTerminalTopicNotificationCommand,
  subscribeTerminalTopicCommand,
  unsubscribeTerminalTopicCommand,
} from '../../../declarations/commands';
import {terminalDataClientActions} from '../../slices/terminalDataClient';
import {terminalConnectionMessageUtf8ByteLength} from '../../../foundations/parseTerminalConnectionMessage';
import type {
  TerminalClientState,
  TerminalDataClientDependencies,
  TerminalTopicSubscription,
  TerminalTransportConnection,
} from '../../../types/client';

export type InstallTerminalTopicCommandsInput = Readonly<{
  readonly dependencies: TerminalDataClientDependencies;
  readonly profileId: string;
  readonly readState: (state: StateRoot) => TerminalClientState;
  readonly isHostRuntime: (state: StateRoot) => boolean;
  readonly flush: (context: ActorExecutionContext) => Promise<void>;
  readonly getConnection: () => TerminalTransportConnection | undefined;
  readonly getConnectionGeneration: () => number;
  readonly isSessionReady: () => boolean;
  readonly isTerminalTopicKey: (value: unknown) => value is TerminalTopicSubscription['topicKey'];
  readonly isCanonicalUuid: (value: unknown) => value is string;
  readonly createProtocolUuid: () => string | null;
  readonly topicIdentityKey: (input: Readonly<{
    credential: NonNullable<TerminalClientState['credential']>;
    subscriberKey: string;
    topicKey: string;
    ownerRef: string;
  }>) => string;
  readonly topicSubscribeFrame: (subscription: TerminalTopicSubscription) => string;
}>;

export const installTerminalTopicCommands = (input: InstallTerminalTopicCommandsInput) => {
  const {
    dependencies,
    profileId,
    readState,
    isHostRuntime,
    flush,
    getConnection,
    getConnectionGeneration,
    isSessionReady,
    isTerminalTopicKey,
    isCanonicalUuid,
    createProtocolUuid,
    topicIdentityKey,
    topicSubscribeFrame,
  } = input;
  return [
    onCommand(subscribeTerminalTopicCommand, async context => {
      const hostRuntime = isHostRuntime(context.getState());
      if (!hostRuntime) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.rejected',
          message: 'Topic subscription requires the host runtime',
          data: {reason: 'NOT_HOST'},
        });
        return Object.freeze({status: 'not-host'});
      }
      const state = readState(context.getState());
      const credential = state.credential;
      const operationConnection = getConnection();
      const operationGeneration = getConnectionGeneration();
      const payload = context.command.payload;
      const existing = Object.values(state.topicSubscriptions).find(
        subscription =>
          subscription.subscriberKey === payload.subscriberKey &&
          subscription.topicKey === payload.topicKey &&
          subscription.ownerRef === payload.ownerRef,
      );
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.begin',
        message: 'Started registering a terminal topic subscription',
        data: {
          topicKey: isTerminalTopicKey(payload.topicKey) ? payload.topicKey : 'invalid',
          activationActive: state.activationStatus === 'active',
          connectionReady: isSessionReady(),
          connectionPresent: operationConnection !== undefined,
          existingSubscription: existing !== undefined,
          persistedSubscriptionCount: Object.keys(state.topicSubscriptions).length,
        },
      });
      if (
        state.activationStatus !== 'active' ||
        credential === null ||
        typeof payload.subscriberKey !== 'string' ||
        payload.subscriberKey.length < 1 ||
        terminalConnectionMessageUtf8ByteLength(payload.subscriberKey) > 128 ||
        !isTerminalTopicKey(payload.topicKey) ||
        !isCanonicalUuid(payload.ownerRef) ||
        !Number.isSafeInteger(payload.initialTimeEpochMillis) ||
        payload.initialTimeEpochMillis < 0
      ) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.rejected',
          message: 'Topic subscription payload or activation was rejected',
          data: {
            topicKey: isTerminalTopicKey(payload.topicKey) ? payload.topicKey : 'invalid',
            reason: 'INVALID_SUBSCRIPTION',
            activationActive: state.activationStatus === 'active',
          },
        });
        return Object.freeze({status: 'rejected', reason: 'INVALID_SUBSCRIPTION'});
      }
      if (existing !== undefined) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.completed',
          message: 'Topic subscription already existed',
          data: {topicKey: payload.topicKey, resultStatus: 'already-subscribed'},
        });
        return Object.freeze({status: 'already-subscribed', subscriptionId: existing.subscriptionId});
      }

      const identityKey = topicIdentityKey({
        credential,
        subscriberKey: payload.subscriberKey,
        topicKey: payload.topicKey,
        ownerRef: payload.ownerRef,
      });
      const acceptedTimeEpochMillis = state.acceptedTopicTimes[identityKey] ?? payload.initialTimeEpochMillis;
      const subscriptionId = createProtocolUuid();
      if (subscriptionId === null) {
        context.platformPorts.logger.warn({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.failed',
          message: 'Subscription identity could not be generated',
          data: {topicKey: payload.topicKey, reason: 'UUID_GENERATION_UNAVAILABLE'},
        });
        return Object.freeze({status: 'failed', reason: 'UUID_GENERATION_UNAVAILABLE'});
      }
      const subscription: TerminalTopicSubscription = Object.freeze({
        subscriptionId,
        identityKey,
        subscriberKey: payload.subscriberKey,
        topicKey: payload.topicKey,
        ownerRef: payload.ownerRef,
        acceptedTimeEpochMillis,
        pendingNotification: null,
      });
      context.dispatchAction(terminalDataClientActions.putTopicSubscription({subscription, identityKey}));
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.persist.begin',
        message: 'Persisted the local topic subscription registration',
        data: {
          topicKey: payload.topicKey,
          persistedSubscriptionCount: Object.keys(readState(context.getState()).topicSubscriptions).length,
        },
      });
      try {
        await flush(context);
      } catch {
        context.dispatchAction(
          terminalDataClientActions.removeTopicSubscription({subscriptionId: subscription.subscriptionId, identityKey}),
        );
        context.platformPorts.logger.warn({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.persist.readback',
          message: 'Local topic subscription persistence failed',
          data: {topicKey: payload.topicKey, resultStatus: 'failed', reason: 'PERSISTENCE_FAILED'},
        });
        return Object.freeze({status: 'failed', reason: 'PERSISTENCE_FAILED'});
      }
      const afterFlush = readState(context.getState());
      const persistedSubscription = afterFlush.topicSubscriptions[subscription.subscriptionId];
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.persist.readback',
        message: 'Read the persisted local topic subscription registration',
        data: {
          topicKey: payload.topicKey,
          resultStatus: 'persisted',
          matchingSubscriptionPresent: persistedSubscription?.identityKey === identityKey,
          persistedSubscriptionCount: Object.keys(afterFlush.topicSubscriptions).length,
        },
      });
      if (
        !isHostRuntime(context.getState()) ||
        afterFlush.activationStatus !== 'active' ||
        afterFlush.credential?.terminalRef !== credential.terminalRef ||
        afterFlush.credential?.storeRef !== credential.storeRef ||
        afterFlush.credential?.bindingGeneration !== credential.bindingGeneration ||
        afterFlush.credential?.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        afterFlush.credential?.deviceId !== credential.deviceId ||
        afterFlush.credential?.credentialSecret !== credential.credentialSecret ||
        afterFlush.topicSubscriptions[subscription.subscriptionId]?.identityKey !== identityKey
      ) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.failed',
          message: 'Topic subscription became stale after persistence',
          data: {
            topicKey: payload.topicKey,
            reason: 'STALE_OPERATION',
            connectionReady: isSessionReady(),
            matchingSubscriptionPresent: persistedSubscription?.identityKey === identityKey,
          },
        });
        return Object.freeze({status: 'stale-operation'});
      }
      if (getConnectionGeneration() !== operationGeneration || getConnection() !== operationConnection) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.failed',
          message: 'Topic subscription connection changed after persistence',
          data: {topicKey: payload.topicKey, reason: 'STALE_CONNECTION', connectionReady: isSessionReady()},
        });
        return Object.freeze({status: 'stale-connection'});
      }
      const sendConnection = getConnection();
      if (isSessionReady() && sendConnection !== undefined) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.frame-send.begin',
          message: 'Sending the topic subscription over the ready connection',
          data: {topicKey: payload.topicKey},
        });
        try {
          await sendConnection.send(topicSubscribeFrame(subscription));
        } catch {
          context.platformPorts.logger.warn({
            category: 'terminal.data.topic-subscription',
            event: 'terminal-topic-subscribe.frame-send.failed',
            message: 'Topic subscription frame send failed',
            data: {topicKey: payload.topicKey, reason: 'SUBSCRIBE_SEND_FAILED'},
          });
          await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
          return Object.freeze({status: 'failed', reason: 'SUBSCRIBE_SEND_FAILED'});
        }
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.frame-send.completed',
          message: 'Topic subscription frame was sent',
          data: {topicKey: payload.topicKey},
        });
      }
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.completed',
        message: 'Topic subscription command completed',
        data: {topicKey: payload.topicKey, resultStatus: isSessionReady() ? 'subscribed' : 'persisted-until-ready'},
      });
      return Object.freeze({status: 'subscribed', subscriptionId: subscription.subscriptionId});
    }),
    onCommand(unsubscribeTerminalTopicCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const operationState = readState(context.getState());
      const credential = operationState.credential;
      const operationConnection = getConnection();
      const operationGeneration = getConnectionGeneration();
      const payload = context.command.payload;
      const subscription = Object.values(readState(context.getState()).topicSubscriptions).find(
        current =>
          current.subscriberKey === payload.subscriberKey &&
          current.topicKey === payload.topicKey &&
          current.ownerRef === payload.ownerRef,
      );
      if (subscription === undefined) return Object.freeze({status: 'not-subscribed'});
      context.dispatchAction(
        terminalDataClientActions.removeTopicSubscription({
          subscriptionId: subscription.subscriptionId,
          identityKey: subscription.identityKey,
        }),
      );
      try {
        await flush(context);
      } catch {
        const afterFlush = readState(context.getState());
        if (
          credential !== null &&
          afterFlush.activationStatus === 'active' &&
          afterFlush.credential?.terminalRef === credential.terminalRef &&
          afterFlush.credential?.storeRef === credential.storeRef &&
          afterFlush.credential?.bindingGeneration === credential.bindingGeneration &&
          afterFlush.credential?.groupWorkspaceKey === credential.groupWorkspaceKey &&
          afterFlush.credential?.deviceId === credential.deviceId &&
          afterFlush.credential?.credentialSecret === credential.credentialSecret
        )
          context.dispatchAction(
            terminalDataClientActions.restoreTopicSubscriptionIfAbsent({
              subscription,
              identityKey: subscription.identityKey,
            }),
          );
        return Object.freeze({status: 'failed', reason: 'PERSISTENCE_FAILED'});
      }
      const afterFlush = readState(context.getState());
      if (
        credential === null ||
        afterFlush.activationStatus !== 'active' ||
        afterFlush.credential?.terminalRef !== credential.terminalRef ||
        afterFlush.credential?.storeRef !== credential.storeRef ||
        afterFlush.credential?.bindingGeneration !== credential.bindingGeneration ||
        afterFlush.credential?.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        afterFlush.credential?.deviceId !== credential.deviceId ||
        afterFlush.credential?.credentialSecret !== credential.credentialSecret
      )
        return Object.freeze({status: 'stale-operation'});
      if (
        Object.values(afterFlush.topicSubscriptions).some(
          current =>
            current.subscriberKey === payload.subscriberKey &&
            current.topicKey === payload.topicKey &&
            current.ownerRef === payload.ownerRef,
        )
      )
        return Object.freeze({status: 'stale-operation'});
      if (getConnectionGeneration() !== operationGeneration || getConnection() !== operationConnection)
        return Object.freeze({status: 'stale-connection'});
      const sendConnection = getConnection();
      if (isSessionReady() && sendConnection !== undefined) {
        try {
          await sendConnection.send(
            JSON.stringify({
              type: 'TOPIC_UNSUBSCRIBE',
              subscriptionId: subscription.subscriptionId,
              topicKey: subscription.topicKey,
              ownerRef: subscription.ownerRef,
            }),
          );
        } catch {
          await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
          return Object.freeze({status: 'failed', reason: 'UNSUBSCRIBE_SEND_FAILED'});
        }
      }
      return Object.freeze({status: 'unsubscribed', subscriptionId: subscription.subscriptionId});
    }),
    onCommand(acceptTerminalTopicNotificationCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const payload = context.command.payload;
      const current = readState(context.getState());
      const subscription = current.topicSubscriptions[payload.subscriptionId];
      const notification = subscription?.pendingNotification;
      const credential = current.credential;
      if (
        credential === null ||
        current.activationStatus !== 'active' ||
        subscription === undefined ||
        subscription.subscriberKey !== payload.subscriberKey ||
        notification === null ||
        notification === undefined ||
        notification.notificationId !== payload.notificationId
      )
        return Object.freeze({status: 'rejected', reason: 'STALE_NOTIFICATION'});
      const previousAcceptedTime = subscription.acceptedTimeEpochMillis;
      const operationConnection = getConnection();
      const operationGeneration = getConnectionGeneration();
      context.dispatchAction(
        terminalDataClientActions.setTopicAcceptedTime({
          subscriptionId: subscription.subscriptionId,
          identityKey: subscription.identityKey,
          acceptedTimeEpochMillis: notification.topicTimeEpochMillis,
        }),
      );
      try {
        await flush(context);
      } catch {
        context.dispatchAction(
          terminalDataClientActions.restoreTopicAcceptedTimeIfCurrent({
            subscriptionId: subscription.subscriptionId,
            identityKey: subscription.identityKey,
            notificationId: notification.notificationId,
            expectedAcceptedTimeEpochMillis: notification.topicTimeEpochMillis,
            acceptedTimeEpochMillis: previousAcceptedTime,
          }),
        );
        return Object.freeze({status: 'failed', reason: 'PERSISTENCE_FAILED'});
      }
      const afterFlush = readState(context.getState());
      const currentSubscription = afterFlush.topicSubscriptions[subscription.subscriptionId];
      if (
        afterFlush.credential?.terminalRef !== credential.terminalRef ||
        afterFlush.credential?.storeRef !== credential.storeRef ||
        afterFlush.activationStatus !== 'active' ||
        afterFlush.credential?.bindingGeneration !== credential.bindingGeneration ||
        afterFlush.credential?.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        afterFlush.credential?.deviceId !== credential.deviceId ||
        afterFlush.credential?.credentialSecret !== credential.credentialSecret ||
        currentSubscription?.identityKey !== subscription.identityKey ||
        currentSubscription.pendingNotification?.notificationId !== notification.notificationId
      )
        return Object.freeze({status: 'stale-notification'});
      if (getConnectionGeneration() !== operationGeneration || getConnection() !== operationConnection)
        return Object.freeze({status: 'stale-connection'});
      const sendConnection = getConnection();
      if (!isSessionReady() || sendConnection === undefined) return Object.freeze({status: 'accepted-locally'});
      try {
        await sendConnection.send(
          JSON.stringify({
            type: 'TOPIC_ACCEPT',
            notificationId: notification.notificationId,
            subscriptionId: subscription.subscriptionId,
            topicKey: subscription.topicKey,
            ownerRef: subscription.ownerRef,
            acceptedTimeEpochMillis: notification.topicTimeEpochMillis,
          }),
        );
      } catch {
        await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
        return Object.freeze({status: 'failed', reason: 'ACCEPT_SEND_FAILED'});
      }
      context.dispatchAction(
        terminalDataClientActions.clearPendingTopicNotification({
          subscriptionId: subscription.subscriptionId,
          notificationId: notification.notificationId,
        }),
      );
      return Object.freeze({status: 'accepted', acceptedTimeEpochMillis: notification.topicTimeEpochMillis});
    }),

  ];
};
