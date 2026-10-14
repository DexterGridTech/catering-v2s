import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {
  selectTerminalTopicSubscriptions,
  type TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import type {StoreBasicBinding} from '../../../types/types';
import {moduleName} from '../../../moduleName';

type SubscriptionChange = Readonly<{readonly ownerRef: string; readonly updatedAt: number}>;

export const reconcileStoreTopicSubscriptions = async (
  input: Readonly<{
    readonly context: ActorExecutionContext;
    readonly binding: StoreBasicBinding;
    readonly isLatest: () => boolean;
    readonly topicKey: TerminalTopicKey;
    readonly desired: readonly SubscriptionChange[];
    readonly checkCurrentMasterBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
    readonly subscribe: (input: Readonly<{
      readonly context: ActorExecutionContext;
      readonly binding: StoreBasicBinding;
      readonly isLatest: () => boolean;
      readonly topicKey: TerminalTopicKey;
      readonly ownerRef: string;
      readonly initialTimeEpochMillis: number;
    }>) => Promise<boolean>;
    readonly unsubscribe: (input: Readonly<{
      readonly context: ActorExecutionContext;
      readonly binding: StoreBasicBinding;
      readonly isLatest: () => boolean;
      readonly topicKey: TerminalTopicKey;
      readonly ownerRef: string;
    }>) => Promise<boolean>;
    readonly setFailure: (context: ActorExecutionContext, topicKey: TerminalTopicKey, errorCode: string) => void;
  }>,
): Promise<boolean> => {
  const {context, binding, isLatest, topicKey, desired, checkCurrentMasterBinding, subscribe, unsubscribe, setFailure} =
    input;
  if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
  const actual = selectTerminalTopicSubscriptions(context.getState()).filter(
    subscription => subscription.subscriberKey === moduleName && subscription.topicKey === topicKey,
  );
  const wanted = new Map(desired.map(item => [item.ownerRef, item.updatedAt]));
  let succeeded = true;
  let failureCode: string | null = null;
  for (const subscription of actual) {
    if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
    if (!wanted.has(subscription.ownerRef)) {
      const removed = await unsubscribe({context, binding, isLatest, topicKey, ownerRef: subscription.ownerRef});
      if (!removed) {
        succeeded = false;
        failureCode ??= 'TOPIC_UNSUBSCRIBE_FAILED';
      }
    }
  }
  for (const [ownerRef, updatedAt] of wanted) {
    if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return false;
    const stillSubscribed = selectTerminalTopicSubscriptions(context.getState()).some(
      subscription =>
        subscription.subscriberKey === moduleName &&
        subscription.topicKey === topicKey &&
        subscription.ownerRef === ownerRef,
    );
    if (
      !stillSubscribed &&
      !(await subscribe({context, binding, isLatest, topicKey, ownerRef, initialTimeEpochMillis: updatedAt}))
    ) {
      succeeded = false;
      failureCode ??= 'TOPIC_SUBSCRIBE_FAILED';
    }
  }
  if (!succeeded && isLatest() && checkCurrentMasterBinding(context, binding))
    setFailure(context, topicKey, failureCode ?? 'TOPIC_SUBSCRIPTION_RECONCILE_FAILED');
  return succeeded;
};
