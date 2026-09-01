import type {
  ErrorCategory,
  ErrorDefinition,
  ErrorSeverity,
} from '../types/error';
import type {
  ParameterDefinition,
  ParameterValueType,
} from '../types/parameter';

export interface DefineErrorInput {
  readonly name: string;
  readonly defaultTemplate: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly code?: string;
}

export interface DefineParameterInput<TValue> {
  readonly name: string;
  readonly defaultValue: TValue;
  readonly decode?: (raw: unknown) => TValue;
  readonly validate?: (value: unknown) => value is TValue;
}

export type ModuleErrorFactory = (localKey: string, input: DefineErrorInput) => ErrorDefinition;

export interface ModuleParameterFactory {
  readonly string: (localKey: string, input: DefineParameterInput<string>) => ParameterDefinition<string>;
  readonly number: (localKey: string, input: DefineParameterInput<number>) => ParameterDefinition<number>;
  readonly boolean: (localKey: string, input: DefineParameterInput<boolean>) => ParameterDefinition<boolean>;
  readonly json: <TValue>(localKey: string, input: DefineParameterInput<TValue>) => ParameterDefinition<TValue>;
}

const createDefinitionKey = (moduleName: string, localKey: string): string => `${moduleName}.${localKey}`;

export const createModuleErrorFactory = (moduleName: string): ModuleErrorFactory => (
  localKey,
  input,
) => ({
  key: createDefinitionKey(moduleName, localKey),
  name: input.name,
  defaultTemplate: input.defaultTemplate,
  category: input.category,
  severity: input.severity,
  code: input.code,
  moduleName,
});

const createParameterDefinition = <TValue>(
  moduleName: string,
  localKey: string,
  valueType: ParameterValueType,
  input: DefineParameterInput<TValue>,
): ParameterDefinition<TValue> => ({
  key: createDefinitionKey(moduleName, localKey),
  name: input.name,
  defaultValue: input.defaultValue,
  valueType,
  moduleName,
  decode: input.decode,
  validate: input.validate,
});

export const createModuleParameterFactory = (moduleName: string): ModuleParameterFactory => ({
  string: (localKey, input) => createParameterDefinition(moduleName, localKey, 'string', input),
  number: (localKey, input) => createParameterDefinition(moduleName, localKey, 'number', input),
  boolean: (localKey, input) => createParameterDefinition(moduleName, localKey, 'boolean', input),
  json: (localKey, input) => createParameterDefinition(moduleName, localKey, 'json', input),
});

export const listDefinitions = <TDefinition extends object>(
  definitions: TDefinition,
): readonly TDefinition[keyof TDefinition][] => Object.values(definitions) as TDefinition[keyof TDefinition][];
