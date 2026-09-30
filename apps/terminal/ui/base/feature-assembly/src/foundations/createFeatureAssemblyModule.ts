import type {ActorDefinition, RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import type {StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';
import type {CreateFeatureAssemblyModuleInput} from '../types/featureAssembly';

const assertFeatureModule = (input: CreateFeatureAssemblyModuleInput): void => {
  if (typeof input !== 'object' || input === null) {
    throw new Error('[ui.base.feature-assembly] module input must be an object');
  }
  if (!input.moduleName.startsWith('ui.feature.')) {
    throw new Error('[ui.base.feature-assembly] moduleName must identify a ui.feature owner');
  }
  if (input.kind !== 'owner') {
    throw new Error('[ui.base.feature-assembly] feature module must be an owner');
  }
};

const cloneList = <T>(value: readonly T[] | undefined): readonly T[] => Object.freeze([...(value ?? [])]);

const commandDescriptors = (definitions: CreateFeatureAssemblyModuleInput['commandDefinitions']) =>
  Object.freeze(definitions.map(definition => ({name: definition.commandName, visibility: definition.visibility})));

const actorDescriptors = (definitions: readonly ActorDefinition[]) =>
  Object.freeze(definitions.map(definition => ({name: definition.actorName})));

const sliceDescriptors = (registrations: readonly StateRuntimeSliceRegistration[] | undefined) =>
  Object.freeze(
    (registrations ?? []).map(registration => ({
      name: registration.name,
      persistIntent: registration.persistIntent,
    })),
  );

export const createFeatureAssemblyModule = (input: CreateFeatureAssemblyModuleInput): RuntimeModule => {
  assertFeatureModule(input);
  const commandDefinitions = cloneList(input.commandDefinitions);
  const actorDefinitions = cloneList(input.actorDefinitions);
  const stateSlices = cloneList(input.stateSlices);
  return Object.freeze({
    dependencies: cloneList(input.dependencies),
    moduleName: input.moduleName,
    kind: input.kind,
    commands: commandDescriptors(commandDefinitions),
    commandDefinitions,
    actors: actorDescriptors(actorDefinitions),
    actorDefinitions,
    slices: sliceDescriptors(stateSlices),
    stateSlices,
  });
};
