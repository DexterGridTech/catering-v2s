import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {TerminalTopicKey} from '@catering-v2s/kernel-base-terminal-data-client';
import type {
  TerminalStoreActiveContractsRead,
  TerminalStoreServicePointAreasRead,
  TerminalStoreServicePointsRead,
} from '../../../generated/terminalApi';
import type {StoreBasicBinding} from '../../../types/types';
import {storeBasicActions} from '../../slices/storeBasicState';
import {reconcileStoreTopicSubscriptions} from './reconcileStoreTopicSubscriptions';

type CollectionRefreshCommon = Readonly<{
  readonly context: ActorExecutionContext;
  readonly binding: StoreBasicBinding;
  readonly isLatest: () => boolean;
  readonly checkCurrentMasterBinding: (context: ActorExecutionContext, binding: StoreBasicBinding) => boolean;
  readonly setLoaded: (context: ActorExecutionContext, topicKey: TerminalTopicKey) => void;
  readonly flush: (context: ActorExecutionContext) => Promise<void>;
  readonly subscribe: Parameters<typeof reconcileStoreTopicSubscriptions>[0]['subscribe'];
  readonly unsubscribe: Parameters<typeof reconcileStoreTopicSubscriptions>[0]['unsubscribe'];
  readonly setFailure: Parameters<typeof reconcileStoreTopicSubscriptions>[0]['setFailure'];
}>;

export const refreshStoreContracts = async (
  input: CollectionRefreshCommon & Readonly<{readonly value: TerminalStoreActiveContractsRead}>,
): Promise<void> => {
  const {context, binding, value, isLatest, checkCurrentMasterBinding, setLoaded, flush, subscribe, unsubscribe, setFailure} =
    input;
  if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return;
  context.dispatchAction(
    storeBasicActions.setActiveContracts({
      value: value.items,
      updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
    }),
  );
  setLoaded(context, 'VALID_CONTRACT_COLLECTION');
  setLoaded(context, 'CONTRACT');
  await flush(context);
  if (!isLatest()) return;
  await reconcileStoreTopicSubscriptions({
    context,
    binding,
    isLatest,
    topicKey: 'CONTRACT',
    desired: value.items.map(item => ({ownerRef: item.id, updatedAt: item.updatedAt})),
    checkCurrentMasterBinding,
    subscribe,
    unsubscribe,
    setFailure,
  });
};

export const refreshStoreAreas = async (
  input: CollectionRefreshCommon & Readonly<{readonly value: TerminalStoreServicePointAreasRead}>,
): Promise<void> => {
  const {context, binding, value, isLatest, checkCurrentMasterBinding, setLoaded, flush, subscribe, unsubscribe, setFailure} =
    input;
  if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return;
  context.dispatchAction(
    storeBasicActions.setAreas({value: value.items, updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis}),
  );
  setLoaded(context, 'SERVICE_POINT_AREA_COLLECTION');
  setLoaded(context, 'SERVICE_POINT_AREA');
  await flush(context);
  if (!isLatest()) return;
  await reconcileStoreTopicSubscriptions({
    context,
    binding,
    isLatest,
    topicKey: 'SERVICE_POINT_AREA',
    desired: value.items.map(item => ({ownerRef: item.areaRef, updatedAt: item.updatedAt})),
    checkCurrentMasterBinding,
    subscribe,
    unsubscribe,
    setFailure,
  });
};

export const refreshStoreServicePoints = async (
  input: CollectionRefreshCommon & Readonly<{readonly value: TerminalStoreServicePointsRead}>,
): Promise<void> => {
  const {context, binding, value, isLatest, checkCurrentMasterBinding, setLoaded, flush, subscribe, unsubscribe, setFailure} =
    input;
  if (!isLatest() || !checkCurrentMasterBinding(context, binding)) return;
  context.dispatchAction(
    storeBasicActions.setServicePoints({
      value: value.items,
      updatedAtEpochMillis: value.collectionUpdatedAtEpochMillis,
    }),
  );
  setLoaded(context, 'SERVICE_POINT_COLLECTION');
  setLoaded(context, 'SERVICE_POINT');
  await flush(context);
  if (!isLatest()) return;
  await reconcileStoreTopicSubscriptions({
    context,
    binding,
    isLatest,
    topicKey: 'SERVICE_POINT',
    desired: value.items.map(item => ({ownerRef: item.pointRef, updatedAt: item.updatedAt})),
    checkCurrentMasterBinding,
    subscribe,
    unsubscribe,
    setFailure,
  });
};
