import {createModuleParameterFactory} from '@catering-v2s/kernel-base-contracts';
import type {RuntimeLimits} from '../types/limits';
import {moduleName} from '../moduleName';

const defineParameter = createModuleParameterFactory(moduleName);
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isInteger(value);

const positiveInteger = (localKey: string, name: string, defaultValue: number) =>
  defineParameter.number(localKey, {name, defaultValue, validate: isPositiveInteger});

export const runtimeParameters = Object.freeze({
  maxCommandDepth: positiveInteger('maxCommandDepth', 'Maximum command depth', 32),
  maxCommandsPerRequest: positiveInteger('maxCommandsPerRequest', 'Maximum commands per request', 256),
  maxActorResultBytes: positiveInteger('maxActorResultBytes', 'Maximum actor result bytes', 262_144),
  requestRetentionMs: positiveInteger('requestRetentionMs', 'Request retention in milliseconds', 1_800_000),
  requestMaxResidenceMs: positiveInteger('requestMaxResidenceMs', 'Request maximum residence in milliseconds', 10_000_000),
  maxJournalRecords: positiveInteger('maxJournalRecords', 'Maximum journal records', 1_000),
  commandTimeoutMs: positiveInteger('commandTimeoutMs', 'Default command timeout in milliseconds', 60_000),
  postCommitConsumerTimeoutMs: positiveInteger(
    'postCommitConsumerTimeoutMs',
    'Post-commit consumer timeout in milliseconds',
    5_000,
  ),
});

export const defaultMaxCommandDepth = runtimeParameters.maxCommandDepth.defaultValue;
export const defaultMaxCommandsPerRequest = runtimeParameters.maxCommandsPerRequest.defaultValue;
export const defaultMaxActorResultBytes = runtimeParameters.maxActorResultBytes.defaultValue;
export const defaultRequestRetentionMs = runtimeParameters.requestRetentionMs.defaultValue;
export const defaultRequestMaxResidenceMs = runtimeParameters.requestMaxResidenceMs.defaultValue;
export const defaultMaxJournalRecords = runtimeParameters.maxJournalRecords.defaultValue;
export const defaultCommandTimeoutMs = runtimeParameters.commandTimeoutMs.defaultValue;
export const postCommitConsumerTimeoutMs = runtimeParameters.postCommitConsumerTimeoutMs.defaultValue;

export const defaultRuntimeLimits: RuntimeLimits = Object.freeze({
  maxCommandDepth: defaultMaxCommandDepth,
  maxCommandsPerRequest: defaultMaxCommandsPerRequest,
  maxActorResultBytes: defaultMaxActorResultBytes,
  requestRetentionMs: defaultRequestRetentionMs,
  requestMaxResidenceMs: defaultRequestMaxResidenceMs,
  maxJournalRecords: defaultMaxJournalRecords,
});
