import type {AppModuleDependency, AppModuleKind} from '@catering-v2s/kernel-base-contracts';
import type {ActorDefinition, CommandDefinition, RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import type {StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';

// A feature assembly is a heterogeneous owner-definition collection.  The
// private command brand is never invoked here; the runtime validates the
// factory-created definition before dispatch.  `any` is therefore confined to
// this collection boundary so payload-specific command definitions can coexist.
type FeatureCommandDefinition = CommandDefinition<any>;

export type CreateFeatureAssemblyModuleInput = Readonly<{
  readonly moduleName: string;
  readonly kind: AppModuleKind;
  readonly dependencies: readonly AppModuleDependency[];
  readonly commandDefinitions: readonly FeatureCommandDefinition[];
  readonly actorDefinitions: readonly ActorDefinition[];
  readonly stateSlices?: readonly StateRuntimeSliceRegistration[];
}>;

export type CreateFeatureAssemblyInput<
  TParts,
  TVariables extends readonly unknown[] | undefined = undefined,
> = Readonly<{
  readonly parts: TParts;
  readonly variables?: TVariables;
  readonly createModule: () => CreateFeatureAssemblyModuleInput;
}>;

export type FeatureAssembly<TParts, TVariables extends readonly unknown[] | undefined = undefined> = Readonly<
  {
    readonly parts: TParts;
    readonly createModule: () => RuntimeModule;
  } & (TVariables extends readonly unknown[] ? {readonly variables: TVariables} : {})
>;

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

const commandDescriptors = (definitions: readonly FeatureCommandDefinition[]) =>
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

export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
export {moduleName} from './moduleName';
