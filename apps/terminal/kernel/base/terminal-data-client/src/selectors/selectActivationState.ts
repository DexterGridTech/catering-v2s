import {defineStateSelector, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {TerminalActivationView} from '../types/client';
import {readTerminalDataClientState} from './readTerminalDataClientState';

const selectActivationStateImplementation = (state: StateRoot): TerminalActivationView => {
  const current = readTerminalDataClientState(state);
  const credential = current.credential;
  const status =
    selectRuntimeInstanceMode(state) === 'SLAVE'
      ? 'inactive'
      : current.activationStatus === 'cancelling'
        ? 'cancelling'
        : current.activationStatus === 'activating'
          ? 'activating'
          : credential !== null
            ? 'active'
            : Object.keys(current.pendingActivations).length > 0
              ? 'activating'
              : 'inactive';
  return Object.freeze({
    status,
    terminalRef: credential?.terminalRef ?? null,
    storeRef: credential?.storeRef ?? null,
    groupWorkspaceKey: credential?.groupWorkspaceKey ?? null,
    bindingGeneration: credential?.bindingGeneration ?? null,
  });
};

export const selectActivationState = defineStateSelector(moduleName, 'selectActivationState', {
  parameters: [],
  selector: selectActivationStateImplementation,
});
