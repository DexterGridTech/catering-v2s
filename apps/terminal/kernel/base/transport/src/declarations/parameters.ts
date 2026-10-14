import {createModuleParameterFactory} from '@catering-v2s/kernel-base-contracts';
import type {TransportReconnectPolicy} from '../types/runtimeControl';
import {moduleName} from '../moduleName';

const defineParameter = createModuleParameterFactory(moduleName);
const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const isReconnectPolicy = (value: unknown): value is TransportReconnectPolicy => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TransportReconnectPolicy>;
  return (
    isPositiveNumber(candidate.initialDelayMs) &&
    isPositiveNumber(candidate.incrementMs) &&
    isPositiveNumber(candidate.maximumDelayMs) &&
    Number.isFinite(candidate.maximumJitterRatio) &&
    (candidate.maximumJitterRatio ?? -1) >= 0 &&
    Number.isFinite(candidate.cappedDelayFloorRatio) &&
    (candidate.cappedDelayFloorRatio ?? -1) >= 0 &&
    (candidate.cappedDelayFloorRatio ?? 2) <= 1 &&
    isPositiveNumber(candidate.readyTimeoutMs) &&
    isPositiveNumber(candidate.networkRecoveryMinimumIntervalMs) &&
    candidate.initialDelayMs <= candidate.maximumDelayMs
  );
};

export const transportParameters = Object.freeze({
  reconnectPolicy: defineParameter.json<TransportReconnectPolicy>('reconnectPolicy', {
    name: 'Transport reconnect policy',
    defaultValue: Object.freeze({
      initialDelayMs: 10_000,
      incrementMs: 1_000,
      maximumDelayMs: 300_000,
      maximumJitterRatio: 0.5,
      cappedDelayFloorRatio: 5 / 6,
      readyTimeoutMs: 20_000,
      networkRecoveryMinimumIntervalMs: 10_000,
    }),
    validate: isReconnectPolicy,
  }),
  networkStatusRequestTimeoutMs: defineParameter.number('networkStatusRequestTimeoutMs', {
    name: 'Network status request timeout in milliseconds',
    defaultValue: 5_000,
    validate: (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  }),
});
