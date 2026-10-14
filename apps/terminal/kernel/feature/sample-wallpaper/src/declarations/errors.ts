import {createModuleErrorFactory} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../moduleName';

const defineError = createModuleErrorFactory(moduleName);

export const invalidWallpaperIdErrorDefinition = defineError('invalid-wallpaper-id', {
  name: 'Sample wallpaper id is invalid',
  defaultTemplate: 'Sample wallpaper id is invalid',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_WALLPAPER_INVALID_ID',
});

export const confirmWithoutPendingErrorDefinition = defineError('confirm-without-pending', {
  name: 'Sample wallpaper has no pending selection',
  defaultTemplate: 'Sample wallpaper has no pending selection to confirm',
  category: 'BUSINESS',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_WALLPAPER_CONFIRM_WITHOUT_PENDING',
});
