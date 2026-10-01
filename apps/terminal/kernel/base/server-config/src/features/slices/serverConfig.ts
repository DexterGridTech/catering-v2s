import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import type {ServerConfigState} from '../../types/serverConfig';

export const serverConfigSliceName = `${moduleName}.configuration` as const;

export const createServerConfigSlice = (input: Readonly<{defaultSpace: string; serviceNames: readonly string[]}>) => {
  const initialState: ServerConfigState = Object.freeze({
    selectedSpace: input.defaultSpace,
    overrides: Object.freeze({}),
    proxyPasswords: Object.freeze({}),
    serviceRevisions: Object.freeze(Object.fromEntries(input.serviceNames.map(serverName => [serverName, 0]))),
  });
  const definition = createSlice({
    name: serverConfigSliceName,
    initialState,
    reducers: {
      replaceConfiguration: (_state, action: PayloadAction<ServerConfigState>): ServerConfigState => action.payload,
    },
  });

  const registration = defineStateRuntimeSlice<ServerConfigState>({
    name: serverConfigSliceName,
    reducer: definition.reducer,
    persistIntent: 'owner-only',
    resetIntent: 'retain',
    persistence: [
      {kind: 'field', stateKey: 'selectedSpace', protection: 'plain', flushMode: 'immediate'},
      {kind: 'field', stateKey: 'overrides', protection: 'plain', flushMode: 'immediate'},
      {
        kind: 'record',
        storageKeyPrefix: 'proxy-passwords',
        protection: 'protected',
        flushMode: 'immediate',
        getEntries: state => state.proxyPasswords,
        applyEntries: (state, entries) => ({...state, proxyPasswords: entries as Readonly<Record<string, string>>}),
      },
    ],
    syncIntent: 'isolated',
  });
  const actions = Object.freeze({replaceConfiguration: definition.actions.replaceConfiguration});
  return Object.freeze({registration, actions});
};
