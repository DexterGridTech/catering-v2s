import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {
  TerminalContractRead,
  TerminalServicePointAreaRead,
  TerminalServicePointRead,
} from '../../../generated/terminalApi';
import {selectStoreBasicState} from '../../../selectors/selectStoreBasicState';
import {storeBasicActions} from '../../slices/storeBasicState';
import type {StoreBasicBinding} from '../../../types/types';
import type {TerminalTopicKey} from '@catering-v2s/kernel-base-terminal-data-client';

type StoreDetailInput<TValue> = Readonly<{
  readonly context: ActorExecutionContext;
  readonly binding: StoreBasicBinding;
  readonly id: string;
  readonly value: TValue;
  readonly isLatest: () => boolean;
  readonly unsubscribe: (input: Readonly<{
    readonly context: ActorExecutionContext;
    readonly binding: StoreBasicBinding;
    readonly isLatest: () => boolean;
    readonly topicKey: TerminalTopicKey;
    readonly ownerRef: string;
  }>) => Promise<boolean>;
}>;

export const applyContractDetail = async (
  input: StoreDetailInput<TerminalContractRead>,
): Promise<boolean> => {
  const {context, binding, id, value, isLatest, unsubscribe} = input;
  if (!isLatest()) return true;
  const current = selectStoreBasicState(context.getState()).activeContracts;
  if (current === null || !current.value.some(item => item.id === id)) return true;
  const items =
    value.contract.status === 'VALID'
      ? current.value.map(item => (item.id === id ? value.contract : item))
      : current.value.filter(item => item.id !== id);
  context.dispatchAction(
    storeBasicActions.setActiveContracts({value: items, updatedAtEpochMillis: current.updatedAtEpochMillis}),
  );
  return value.contract.status !== 'VALID'
    ? unsubscribe({context, binding, isLatest, topicKey: 'CONTRACT', ownerRef: id})
    : true;
};

export const applyAreaDetail = async (input: StoreDetailInput<TerminalServicePointAreaRead>): Promise<boolean> => {
  const {context, binding, id, value, isLatest, unsubscribe} = input;
  if (!isLatest()) return true;
  const current = selectStoreBasicState(context.getState()).areas;
  if (current === null || !current.value.some(item => item.areaRef === id)) return true;
  const items =
    value.area.status === 'ENABLED'
      ? current.value.map(item => (item.areaRef === id ? value.area : item))
      : current.value.filter(item => item.areaRef !== id);
  context.dispatchAction(
    storeBasicActions.setAreas({value: items, updatedAtEpochMillis: current.updatedAtEpochMillis}),
  );
  return value.area.status !== 'ENABLED'
    ? unsubscribe({context, binding, isLatest, topicKey: 'SERVICE_POINT_AREA', ownerRef: id})
    : true;
};

export const applyServicePointDetail = async (input: StoreDetailInput<TerminalServicePointRead>): Promise<boolean> => {
  const {context, binding, id, value, isLatest, unsubscribe} = input;
  if (!isLatest()) return true;
  const current = selectStoreBasicState(context.getState()).servicePoints;
  if (current === null || !current.value.some(item => item.pointRef === id)) return true;
  const items =
    value.servicePoint.status === 'ENABLED'
      ? current.value.map(item => (item.pointRef === id ? value.servicePoint : item))
      : current.value.filter(item => item.pointRef !== id);
  context.dispatchAction(
    storeBasicActions.setServicePoints({value: items, updatedAtEpochMillis: current.updatedAtEpochMillis}),
  );
  return value.servicePoint.status !== 'ENABLED'
    ? unsubscribe({context, binding, isLatest, topicKey: 'SERVICE_POINT', ownerRef: id})
    : true;
};
