import {createModuleErrorFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineError = createModuleErrorFactory(moduleName);

export const invalidCredentialsErrorDefinition = defineError('invalid-credentials', {
  name: 'Sample staff credentials are invalid',
  defaultTemplate: 'Sample staff credentials are invalid',
  category: 'AUTHENTICATION',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_STAFF_INVALID_CREDENTIALS',
});
