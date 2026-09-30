import type {AppModuleDependency, AppModuleKind} from '@catering-v2s/kernel-base-contracts';
import type {ActorDefinition, CommandDefinition, RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import type {StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';

// A feature assembly is a heterogeneous owner-definition collection. The
// private command brand is never invoked here; the runtime validates the
// factory-created definition before dispatch. `any` is therefore confined to
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
