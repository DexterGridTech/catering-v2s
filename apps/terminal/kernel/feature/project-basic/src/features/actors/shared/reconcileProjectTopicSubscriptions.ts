import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {
  selectTerminalTopicSubscriptions,
  type TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import type {TerminalStoreOrganizationPathRead} from '../../../generated/terminalApi';
import {moduleName} from '../../../moduleName';
import {organizationTopicKeys} from '../../../declarations/topics';
import {projectBasicActions} from '../../slices/projectBasicState';

type Subscribe = (
  context: ActorExecutionContext,
  input: Readonly<{topicKey: TerminalTopicKey; ownerRef: string; initialTimeEpochMillis: number}>,
) => Promise<boolean>;
type Unsubscribe = (context: ActorExecutionContext, topicKey: TerminalTopicKey, ownerRef: string) => Promise<boolean>;

export const reconcileProjectTopicSubscriptions = async (input: Readonly<{
  readonly context: ActorExecutionContext;
  readonly path: TerminalStoreOrganizationPathRead;
  readonly isCurrent: () => boolean;
  readonly subscribe: Subscribe;
  readonly unsubscribe: Unsubscribe;
}>): Promise<boolean> => {
  const {context, path, isCurrent, subscribe, unsubscribe} = input;
  const desired = new Map<TerminalTopicKey, {ownerRef: string; updatedAt: number}>([
    ['PROJECT', {ownerRef: path.projectRef, updatedAt: path.projectUpdatedAtEpochMillis}],
    ['REGION', {ownerRef: path.regionRef, updatedAt: path.regionUpdatedAtEpochMillis}],
    ['COMMERCIAL_GROUP', {ownerRef: path.commercialGroupRef, updatedAt: path.commercialGroupUpdatedAtEpochMillis}],
  ]);
  let succeeded = true;
  const current = selectTerminalTopicSubscriptions(context.getState()).filter(
    item =>
      item.subscriberKey === moduleName && organizationTopicKeys.includes(item.topicKey as (typeof organizationTopicKeys)[number]),
  );
  for (const item of current) {
    if (!isCurrent()) return false;
    const next = desired.get(item.topicKey);
    if (next === undefined || next.ownerRef !== item.ownerRef) {
      const removed = await unsubscribe(context, item.topicKey, item.ownerRef);
      if (!isCurrent()) return false;
      succeeded = removed && succeeded;
    }
  }
  for (const [topicKey, value] of desired) {
    if (!isCurrent()) return false;
    const exists = selectTerminalTopicSubscriptions(context.getState()).some(
      item => item.subscriberKey === moduleName && item.topicKey === topicKey && item.ownerRef === value.ownerRef,
    );
    if (!exists) {
      const added = await subscribe(context, {
        topicKey,
        ownerRef: value.ownerRef,
        initialTimeEpochMillis: value.updatedAt,
      });
      if (!isCurrent()) return false;
      succeeded = added && succeeded;
    }
  }
  if (!isCurrent()) return false;
  for (const topicKey of organizationTopicKeys)
    context.dispatchAction(
      projectBasicActions.setTopicState({
        topicKey,
        status: succeeded ? 'loaded' : 'failed',
        errorCode: succeeded ? null : 'TOPIC_SUBSCRIPTION_FAILED',
      }),
    );
  return succeeded;
};
