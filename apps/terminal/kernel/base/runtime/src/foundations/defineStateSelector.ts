import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {AnyStateSelector, StateSelector, StateSelectorMetadata, StateSelectorParameters} from '../types/selector';
import {assertNonEmptyString} from './assertNonEmptyString';

const definition = Symbol('runtimeStateSelectorDefinition');
type DefinedSelector<TReturn = unknown, TArgs extends readonly unknown[] = readonly unknown[]> = StateSelector<TReturn, TArgs> &
  Readonly<{[definition]: StateSelectorMetadata}>;

export const defineStateSelector = <TReturn, TArgs extends readonly unknown[]>(
  moduleName: string,
  selectorName: string,
  options: Readonly<{
    parameters: StateSelectorParameters;
    selector: (state: StateRoot, ...args: TArgs) => TReturn;
  }>,
): StateSelector<TReturn, TArgs> => {
  assertNonEmptyString(moduleName, '', 'Runtime selector module name');
  assertNonEmptyString(selectorName, '', 'Runtime selector name');
  if (selectorName.includes('.')) throw new Error(`Runtime selector name must be bare: ${selectorName}`);
  if (typeof options.selector !== 'function') throw new Error(`Runtime selector must be a function: ${selectorName}`);
  const metadata: StateSelectorMetadata = Object.freeze({
    moduleName,
    selectorName,
    parameters: Object.freeze(options.parameters.map(parameter => Object.freeze({...parameter}))),
  });
  const defined = Object.assign(
    (state: StateRoot, ...args: TArgs): TReturn => options.selector(state, ...args),
    {[definition]: metadata},
  ) as DefinedSelector<TReturn, TArgs>;
  return Object.freeze(defined);
};

export const readStateSelectorMetadata = (selector: AnyStateSelector): StateSelectorMetadata | undefined =>
  typeof selector === 'function' && definition in selector
    ? (selector as DefinedSelector)[definition]
    : undefined;
