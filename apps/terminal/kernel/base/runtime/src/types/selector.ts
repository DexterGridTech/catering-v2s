import type {StateRoot} from '@catering-v2s/kernel-base-state';

export type SelectorParameterSchema =
  | Readonly<{kind: 'string'; optional?: boolean}>
  | Readonly<{kind: 'number'; optional?: boolean}>
  | Readonly<{kind: 'boolean'; optional?: boolean}>
  | Readonly<{kind: 'null'; optional?: boolean}>
  | Readonly<{kind: 'enum'; values: readonly (string | number | boolean | null)[]; optional?: boolean}>
  | Readonly<{kind: 'array'; items: SelectorParameterSchema; optional?: boolean}>
  | Readonly<{kind: 'object'; properties: Readonly<Record<string, SelectorParameterSchema>>; optional?: boolean}>;

export type StateSelectorParameters = readonly SelectorParameterSchema[];

export type StateSelectorMetadata = Readonly<{
  moduleName: string;
  selectorName: string;
  parameters: StateSelectorParameters;
}>;

export type StateSelector<TReturn = unknown, TArgs extends readonly unknown[] = readonly unknown[]> = (
  state: StateRoot,
  ...args: TArgs
) => TReturn;

export type AnyStateSelector = StateSelector<unknown, never>;
