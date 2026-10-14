import {createModuleErrorFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineError = createModuleErrorFactory(moduleName);

export const layerPartUnavailableErrorDefinition = defineError('layer-part-unavailable', {
  name: 'UI layer part is unavailable for the current surface',
  defaultTemplate: 'UI layer part is unavailable for the current surface',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_UI_STATE_LAYER_PART_UNAVAILABLE',
});
