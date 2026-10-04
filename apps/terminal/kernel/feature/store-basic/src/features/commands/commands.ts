import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import type {
  TerminalActivationSucceededPayload,
  TerminalTopicChangedPayload,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName} from '../../moduleName';

export type StoreBasicRefreshPayload = Readonly<{
  readonly binding: TerminalActivationSucceededPayload;
  readonly notification: TerminalTopicChangedPayload['notification'];
}>;

export const initializeStoreBasicCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'initialize-store-basic',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const storeBasicInformationLoadedCommand = defineCommand<TerminalActivationSucceededPayload>(moduleName, {
  name: 'store-basic-information-loaded',
  visibility: 'public',
  allowNoActor: true,
  allowReentry: false,
  defaultTarget: 'local',
});
export const initializeStoreServicePointsCommand = defineCommand<
  Readonly<{binding: TerminalActivationSucceededPayload}>
>(moduleName, {
  name: 'initialize-store-service-points',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const refreshStoreBasicTopicCommand = defineCommand<StoreBasicRefreshPayload>(moduleName, {
  name: 'refresh-store-basic-topic',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
