import {createModuleParameterFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineParameter = createModuleParameterFactory(moduleName);

export const stateParameters = Object.freeze({
  persistenceDebounceMs: defineParameter.number('persistenceDebounceMs', {
    name: 'Persistence debounce in milliseconds',
    defaultValue: 300,
    validate: (value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  }),
});
