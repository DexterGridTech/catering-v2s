import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import type {CreateFeatureAssemblyInput, FeatureAssembly} from '../types/featureAssembly';
import {createFeatureAssemblyModule} from './createFeatureAssemblyModule';

export const createFeatureAssembly = <TParts, TVariables extends readonly unknown[] | undefined = undefined>(
  input: CreateFeatureAssemblyInput<TParts, TVariables>,
): FeatureAssembly<TParts, TVariables> => {
  if (typeof input !== 'object' || input === null) {
    throw new Error('[ui.base.feature-assembly] assembly input must be an object');
  }
  if (typeof input.createModule !== 'function') {
    throw new Error('[ui.base.feature-assembly] createModule is required');
  }
  const assembly: {
    parts: TParts;
    variables?: readonly unknown[];
    createModule: () => RuntimeModule;
  } = {
    parts: input.parts,
    createModule: () => createFeatureAssemblyModule(input.createModule()),
  };
  if (input.variables !== undefined) assembly.variables = input.variables;
  return Object.freeze(assembly) as FeatureAssembly<TParts, TVariables>;
};
