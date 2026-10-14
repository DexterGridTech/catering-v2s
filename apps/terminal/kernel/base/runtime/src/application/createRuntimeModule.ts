import type {RuntimeModule} from '../types/module';

const freezeList = <T>(items: readonly T[] | undefined): readonly T[] => Object.freeze([...(items ?? [])]);

/**
 * Creates one immutable Runtime module from its concrete definitions.
 * Runtime descriptions are derived later from these same arrays.
 */
export const createRuntimeModule = <TModule extends RuntimeModule>(input: TModule): TModule => {
  if (
    typeof input !== 'object' ||
    input === null ||
    typeof input.moduleName !== 'string' ||
    input.moduleName.length === 0
  ) {
    throw new Error('Runtime module requires a non-empty moduleName');
  }
  if (input.kind !== 'owner' && input.kind !== 'toolkit') {
    throw new Error(`Runtime module kind is invalid: ${String(input.kind)}`);
  }
  if ('commands' in input || 'actors' in input || 'slices' in input) {
    throw new Error('Runtime module accepts concrete definitions, not parallel descriptors');
  }

  const commandDefinitions = freezeList(input.commandDefinitions);
  const actorDefinitions = freezeList(input.actorDefinitions);
  const selectorDefinitions = freezeList(input.selectorDefinitions);
  const stateSlices = freezeList(input.stateSlices);
  const dependencies = freezeList(input.dependencies);

  return Object.freeze({
    ...input,
    dependencies,
    commandDefinitions,
    actorDefinitions,
    selectorDefinitions,
    stateSlices,
  }) as TModule;
};
