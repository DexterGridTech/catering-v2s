import type {PersistIntent, StateJsonValue} from '@catering-v2s/kernel-base-state';

/**
 * Kept private to the package root: declarations must come from the module
 * variable factory before they can enter a module registry.
 */
export const uiVariableDeclarationBrand: unique symbol = Symbol('uiVariableDeclarationBrand');

export type UiVariableDeclaration<TValue extends StateJsonValue> = Readonly<{
  readonly key: string;
  readonly moduleName: string;
  readonly defaultValue: TValue;
  readonly persistIntent: PersistIntent;
  readonly [uiVariableDeclarationBrand]: true;
}>;

export type UiVariableWrite<TValue extends StateJsonValue> = Readonly<{
  readonly key: string;
  readonly value: TValue;
}>;

export type UiVariableDefinitionInput<TValue extends StateJsonValue> = Readonly<{
  readonly defaultValue: TValue;
  readonly persistIntent: PersistIntent;
}>;

export interface UiVariableFactory {
  readonly define: <TValue extends StateJsonValue>(
    localKey: string,
    input: UiVariableDefinitionInput<TValue>,
  ) => UiVariableDeclaration<TValue>;
}
