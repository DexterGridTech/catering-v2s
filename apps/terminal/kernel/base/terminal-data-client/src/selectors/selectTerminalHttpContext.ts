import {defineStateSelector, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectServerConfigServiceContext} from '@catering-v2s/kernel-base-server-config';
import {moduleName} from '../moduleName';
import {terminalDataClientSliceName} from '../features/slices/terminalDataClient';
import type {TerminalClientState, TerminalHttpContext} from '../types/client';

const selectTerminalHttpContextImplementation = (state: StateRoot, serviceName: string): TerminalHttpContext | null => {
  const slice = state[terminalDataClientSliceName] as TerminalClientState | undefined;
  const service = selectServerConfigServiceContext(state, {serviceName});
  const credential = slice?.credential;
  if (slice === undefined || credential === null || credential === undefined || service === null) return null;
  return Object.freeze({
    credentialRevision: slice.credentialRevision,
    groupWorkspaceKey: credential.groupWorkspaceKey,
    terminalRef: credential.terminalRef,
    storeRef: credential.storeRef,
    bindingGeneration: credential.bindingGeneration,
    instanceMode: selectRuntimeInstanceMode(state),
    selectedSpace: service.selectedSpace,
    serviceName,
    serviceRevision: service.serviceRevision,
    ready:
      slice.credentialReadyRevision === slice.credentialRevision &&
      slice.credentialReadyInstanceMode === selectRuntimeInstanceMode(state) &&
      (selectRuntimeInstanceMode(state) === 'MASTER'
        ? slice.activationStatus === 'active'
        : slice.activationStatus === 'inactive'),
  });
};

export const selectTerminalHttpContext = defineStateSelector(moduleName, 'selectTerminalHttpContext', {
  parameters: [
    {kind: 'object', properties: {serviceName: {kind: 'string'}}},
  ],
  selector: (state: StateRoot, input: Readonly<{serviceName: string}>) =>
    selectTerminalHttpContextImplementation(state, input.serviceName),
});
