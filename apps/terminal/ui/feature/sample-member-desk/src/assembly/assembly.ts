import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {createFeatureAssembly, type FeatureAssembly} from '@catering-v2s/ui-base-feature-assembly';
import {createSampleMemberDeskModuleInput} from '../application/module';
import {layerDismissals, parts} from '../parts/parts';

export type MemberDeskAssembly = FeatureAssembly<typeof parts> &
  Readonly<{
    readonly layerDismissals: typeof layerDismissals;
  }>;

const featureAssembly = createFeatureAssembly({
  parts,
  createModule: createSampleMemberDeskModuleInput,
});

export const sampleMemberDeskAssembly: MemberDeskAssembly = Object.freeze({
  ...featureAssembly,
  layerDismissals,
});
