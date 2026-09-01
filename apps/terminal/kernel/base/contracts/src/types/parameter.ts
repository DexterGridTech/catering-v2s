export type ParameterValueType = 'string' | 'number' | 'boolean' | 'json';

export interface ParameterDescriptor {
  readonly key: string;
  readonly name: string;
  readonly defaultValue: unknown;
  readonly valueType: ParameterValueType;
  readonly moduleName?: string;
  readonly decode?: (raw: unknown) => unknown;
  readonly validate?: (value: unknown) => boolean;
}

export interface ParameterDefinition<TValue = unknown> extends ParameterDescriptor {
  readonly defaultValue: TValue;
  readonly decode?: (raw: unknown) => TValue;
  readonly validate?: (value: unknown) => value is TValue;
}
