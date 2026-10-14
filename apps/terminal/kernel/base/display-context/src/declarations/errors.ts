import {moduleName} from '../moduleName';

export const displayErrorDefinition = Object.freeze({
  key: `${moduleName}.transition_rejected`,
  name: 'Display context transition rejected',
  defaultTemplate: 'Display context transition rejected',
  category: 'VALIDATION' as const,
  severity: 'MEDIUM' as const,
  code: 'ERR_TER_DISPLAY_CONTEXT_TRANSITION_REJECTED',
  moduleName,
});
