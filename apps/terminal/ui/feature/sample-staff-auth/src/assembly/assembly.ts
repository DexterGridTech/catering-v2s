import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {UiVariableDeclaration} from '@catering-v2s/kernel-base-ui-state';
import {createFeatureAssembly, type FeatureAssembly} from '@catering-v2s/ui-base-feature-assembly';
import {createSampleStaffAuthModuleInput} from '../application/module';
import {layerDismissals, parts} from '../parts/parts';
import {variables} from '../features/variables/variables';

export type StaffAuthAssembly = FeatureAssembly<typeof parts, readonly UiVariableDeclaration<StateJsonValue>[]> &
  Readonly<{readonly layerDismissals: typeof layerDismissals}>;

const featureAssembly = createFeatureAssembly({
  parts,
  variables,
  createModule: createSampleStaffAuthModuleInput,
});

export const sampleStaffAuthAssembly: StaffAuthAssembly = Object.freeze({
  ...featureAssembly,
  layerDismissals,
});
