import {createModuleParameterFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineParameter = createModuleParameterFactory(moduleName);

export const remoteControlParameters = Object.freeze({
  keepaliveTimeoutMs: defineParameter.number('keepaliveTimeoutMs', {
    name: 'Remote control keepalive timeout in milliseconds',
    defaultValue: 15_000,
    validate: (value): value is number =>
      typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
  }),
});
