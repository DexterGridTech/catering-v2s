import {createModuleParameterFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineParameter = createModuleParameterFactory(moduleName);
const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isInteger(value);
export const terminalDataClientParameters = Object.freeze({
  callTimeoutMs: defineParameter.number('callTimeoutMs', {
    name: 'Terminal client call timeout in milliseconds',
    defaultValue: 5_000,
    validate: isPositiveInteger,
  }),
  remoteOperationLimit: defineParameter.number('remoteOperationLimit', {
    name: 'Maximum retained remote operations',
    defaultValue: 64,
    validate: isPositiveInteger,
  }),
  remoteResultResidenceMs: defineParameter.number('remoteResultResidenceMs', {
    name: 'Remote result observation residence in milliseconds',
    defaultValue: 7_200_000,
    validate: isPositiveInteger,
  }),
  latencyWindowMs: defineParameter.number('latencyWindowMs', {
    name: 'Connection latency history window in milliseconds',
    defaultValue: 7_200_000,
    validate: isPositiveInteger,
  }),
});
