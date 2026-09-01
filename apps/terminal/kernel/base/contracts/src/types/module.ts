import type {ErrorDefinition} from './error';
import type {ParameterDescriptor} from './parameter';

export type AppModuleKind = 'owner' | 'toolkit';

export interface AppModuleDependency {
  readonly moduleName: string;
  readonly optional?: boolean;
}

export interface AppModuleCommandDescriptor {
  readonly name: string;
  readonly visibility?: 'public' | 'internal';
}

export interface AppModuleActorDescriptor {
  readonly name: string;
}

export interface AppModuleSliceDescriptor {
  readonly name: string;
  readonly persistIntent?: 'never' | 'owner-only';
}

export interface AppModule {
  readonly moduleName: string;
  readonly kind: AppModuleKind;
  readonly packageVersion?: string;
  readonly protocolVersion?: string;
  readonly dependencies?: readonly AppModuleDependency[];
  readonly errorDefinitions?: readonly ErrorDefinition[];
  readonly parameterDefinitions?: readonly ParameterDescriptor[];
  readonly commands?: readonly AppModuleCommandDescriptor[];
  readonly actors?: readonly AppModuleActorDescriptor[];
  readonly slices?: readonly AppModuleSliceDescriptor[];
}
