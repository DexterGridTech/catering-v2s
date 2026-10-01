import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {TransportNetworkTransition, TransportStartInput} from '../../types/runtimeControl';

export const transportStartCommand = defineCommand<TransportStartInput>(moduleName, {
  name: 'start',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportReadyCommand = defineCommand<Readonly<{profileId: string; stableAfterMs: number}>>(moduleName, {
  name: 'ready',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportInvalidCommand = defineCommand<Readonly<{profileId: string; cause: string}>>(moduleName, {
  name: 'invalid',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportStopCommand = defineCommand<Readonly<{profileId: string}>>(moduleName, {
  name: 'stop',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportNetworkStatusChangedCommand = defineCommand<TransportNetworkTransition>(moduleName, {
  name: 'network-status-changed',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportRetryDueCommand = defineCommand<Readonly<{profileId: string; token: number}>>(moduleName, {
  name: 'retry-due',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportReadyTimeoutCommand = defineCommand<Readonly<{profileId: string; token: number}>>(moduleName, {
  name: 'ready-timeout',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportStablePeriodElapsedCommand = defineCommand<Readonly<{profileId: string; token: number}>>(
  moduleName,
  {
    name: 'stable-period-elapsed',
    visibility: 'internal',
    allowNoActor: false,
    allowReentry: false,
    defaultTarget: 'local',
  },
);
export const transportHttpRequestCommand = defineCommand<Readonly<{requestId: string}>>(moduleName, {
  name: 'http-request',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const transportHttpAddressAvailableCommand = defineCommand<
  Readonly<{profileId: string; serverName: string; addressName: string; configRevision: number}>
>(moduleName, {
  name: 'http-address-available',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
