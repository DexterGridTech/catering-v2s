import {createModuleErrorFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineError = createModuleErrorFactory(moduleName);

export const noPendingMemberErrorDefinition = defineError('no-pending-member', {
  name: 'No pending member registration',
  defaultTemplate: 'No pending member registration is available to confirm',
  category: 'BUSINESS',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_MEMBER_NO_PENDING',
});

export const invalidMemberPayloadErrorDefinition = defineError('invalid-member-payload', {
  name: 'Sample member payload is invalid',
  defaultTemplate: 'Sample member payload is invalid',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_MEMBER_INVALID_PAYLOAD',
});
