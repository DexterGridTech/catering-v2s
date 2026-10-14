import {createModuleErrorFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineError = createModuleErrorFactory(moduleName);

export const invalidServerConfigInputErrorDefinition = defineError('invalid-input', {
  name: 'Server configuration input is invalid',
  defaultTemplate: 'Server configuration input is invalid',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_SERVER_CONFIG_INVALID_INPUT',
});

export const serverConfigMutationNotAllowedErrorDefinition = defineError('mutation-not-allowed', {
  name: 'Server configuration mutation is not allowed',
  defaultTemplate: 'Only the MASTER terminal can change server configuration',
  category: 'AUTHORIZATION',
  severity: 'LOW',
  code: 'ERR_TER_SERVER_CONFIG_MUTATION_NOT_ALLOWED',
});
