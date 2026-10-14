import {createModuleErrorFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineError = createModuleErrorFactory(moduleName);

export const childDispatchFailureDefinition = defineError('child-dispatch-failed', {
  name: 'Wallpaper picker child dispatch failed',
  defaultTemplate: 'Wallpaper picker child dispatch failed',
  category: 'SYSTEM',
  severity: 'MEDIUM',
  code: 'ERR_TER_SAMPLE_WALLPAPER_PICKER_CHILD_DISPATCH_FAILED',
});
