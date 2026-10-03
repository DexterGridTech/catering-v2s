import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {
  defineStateRuntimeSlice,
  type StateJsonValue,
  type SyncRecordState,
  type SyncValueEnvelope,
} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import type {ServerConfigState} from '../../types/serverConfig';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {
  defaultServiceNames,
  validateProxy,
  validateServerAddress,
  validateServerConfigDefaults,
} from '../../foundations/validateServerConfigDefaults';

export const serverConfigSliceName = `${moduleName}.configuration` as const;

export const createServerConfigSlice = (
  input: Readonly<{defaults: TransportServerConfig; serviceNames: readonly string[]}>,
) => {
  const initialState: ServerConfigState = Object.freeze({
    selectedSpace: input.defaults.selectedSpace,
    overrides: Object.freeze({}),
    proxyPasswords: Object.freeze({}),
    syncedHostDefaults: null,
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
      {kind: 'field', stateKey: 'syncedHostDefaults', protection: 'plain', flushMode: 'immediate'},
      {
        kind: 'record',
        storageKeyPrefix: 'proxy-passwords',
        protection: 'plain',
        flushMode: 'immediate',
        getEntries: state => state.proxyPasswords,
        applyEntries: (state, entries) => ({...state, proxyPasswords: entries as Readonly<Record<string, string>>}),
      },
    ],
    syncIntent: 'master-to-slave',
    sync: {
      kind: 'record',
      getEntries: (state): SyncRecordState => ({
        configuration: {
          value: {
            defaults: input.defaults as unknown as StateJsonValue,
            selectedSpace: state.selectedSpace,
            overrides: state.overrides as unknown as StateJsonValue,
            proxyPasswords: state.proxyPasswords as unknown as StateJsonValue,
            serviceRevisions: state.serviceRevisions as unknown as StateJsonValue,
          },
          updatedAt: nowTimestampMs(),
        },
      }),
      applyEntries: (state, entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>) => {
        const entry = entries.configuration;
        if (entry === undefined || entry.tombstone === true) throw new Error('SERVER_CONFIG_SYNC_INVALID');
        const value = entry.value as unknown;
        if (typeof value !== 'object' || value === null || Array.isArray(value))
          throw new Error('SERVER_CONFIG_SYNC_INVALID');
        const projection = value as Record<string, unknown>;
        const selectedSpace = projection.selectedSpace;
        const overrides = projection.overrides;
        const proxyPasswords = projection.proxyPasswords;
        const serviceRevisions = projection.serviceRevisions;
        const defaults = projection.defaults;
        if (
          typeof selectedSpace !== 'string' ||
          typeof overrides !== 'object' ||
          overrides === null ||
          Array.isArray(overrides) ||
          typeof proxyPasswords !== 'object' ||
          proxyPasswords === null ||
          Array.isArray(proxyPasswords) ||
          typeof serviceRevisions !== 'object' ||
          serviceRevisions === null ||
          Array.isArray(serviceRevisions) ||
          typeof defaults !== 'object' ||
          defaults === null ||
          Array.isArray(defaults)
        )
          throw new Error('SERVER_CONFIG_SYNC_INVALID');
        const hostDefaults = defaults as TransportServerConfig;
        validateServerConfigDefaults(hostDefaults);
        if (!hostDefaults.spaces.some(space => space.name === selectedSpace))
          throw new Error('SERVER_CONFIG_SYNC_INVALID');
        const knownServices = new Set(defaultServiceNames(hostDefaults));
        for (const [serverName, rawOverride] of Object.entries(overrides)) {
          if (
            !knownServices.has(serverName) ||
            typeof rawOverride !== 'object' ||
            rawOverride === null ||
            Array.isArray(rawOverride)
          )
            throw new Error('SERVER_CONFIG_SYNC_INVALID');
          const override = rawOverride as Record<string, unknown>;
          if (!Array.isArray(override.addresses) || override.addresses.length < 1 || override.addresses.length > 4)
            throw new Error('SERVER_CONFIG_SYNC_INVALID');
          for (const address of override.addresses) {
            if (typeof address !== 'object' || address === null || Array.isArray(address))
              throw new Error('SERVER_CONFIG_SYNC_INVALID');
            validateServerAddress(address as never, true);
          }
          if (override.proxy !== null) {
            if (typeof override.proxy !== 'object' || override.proxy === null || Array.isArray(override.proxy))
              throw new Error('SERVER_CONFIG_SYNC_INVALID');
            const password = (proxyPasswords as Record<string, unknown>)[serverName];
            validateProxy({...override.proxy, ...(typeof password === 'string' ? {password} : {})} as never);
          } else if (Object.prototype.hasOwnProperty.call(proxyPasswords, serverName)) {
            throw new Error('SERVER_CONFIG_SYNC_INVALID');
          }
        }
        for (const [serverName, password] of Object.entries(proxyPasswords)) {
          if (!knownServices.has(serverName) || typeof password !== 'string')
            throw new Error('SERVER_CONFIG_SYNC_INVALID');
        }
        for (const [serverName, revision] of Object.entries(serviceRevisions)) {
          if (!knownServices.has(serverName) || !Number.isSafeInteger(revision) || Number(revision) < 0)
            throw new Error('SERVER_CONFIG_SYNC_INVALID');
        }
        return Object.freeze({
          ...state,
          selectedSpace,
          overrides: overrides as ServerConfigState['overrides'],
          proxyPasswords: proxyPasswords as ServerConfigState['proxyPasswords'],
          serviceRevisions: serviceRevisions as ServerConfigState['serviceRevisions'],
          syncedHostDefaults: hostDefaults,
        });
      },
    },
  });
  const actions = Object.freeze({replaceConfiguration: definition.actions.replaceConfiguration});
  return Object.freeze({registration, actions});
};
