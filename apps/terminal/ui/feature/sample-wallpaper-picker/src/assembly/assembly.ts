import {createFeatureAssembly, type FeatureAssembly} from '@catering-v2s/ui-base-feature-assembly';
import {createSampleWallpaperPickerModuleInput} from '../application/module';
import {layerDismissals, parts} from '../parts/parts';

export type WallpaperPickerAssembly = FeatureAssembly<typeof parts> &
  Readonly<{
    readonly layerDismissals: typeof layerDismissals;
  }>;

const featureAssembly = createFeatureAssembly({
  parts,
  createModule: createSampleWallpaperPickerModuleInput,
});

export const sampleWallpaperPickerAssembly: WallpaperPickerAssembly = Object.freeze({
  ...featureAssembly,
  layerDismissals,
});
