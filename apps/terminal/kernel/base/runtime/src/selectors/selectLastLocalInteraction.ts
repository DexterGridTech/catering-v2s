import {defineStateSelector} from '../foundations/defineStateSelector';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {localInteractionSliceName, type LocalInteractionState} from '../features/slices/localInteraction';

const readLocalInteraction = (state: StateRoot): LocalInteractionState => {
  const slice = state[localInteractionSliceName];
  if (typeof slice !== 'object' || slice === null || Array.isArray(slice)) {
    throw new Error(`Missing local interaction slice: ${localInteractionSliceName}`);
  }
  const lastClickAt = Reflect.get(slice, 'lastClickAt');
  const revision = Reflect.get(slice, 'revision');
  if (!Number.isSafeInteger(lastClickAt) || lastClickAt < 0 || !Number.isSafeInteger(revision) || revision < 0) {
    throw new Error(`Invalid local interaction slice: ${localInteractionSliceName}`);
  }
  return Object.freeze({lastClickAt, revision});
};

export const selectLastLocalInteraction = defineStateSelector(moduleName, 'selectLastLocalInteraction', {
  parameters: [],
  selector: (state: StateRoot) => readLocalInteraction(state),
});
