import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {serverConfigSliceName} from '../features/slices/serverConfig';
import type {ServerConfigState} from '../types/serverConfig';

export type ServerConfigServiceContext = Readonly<{
  readonly selectedSpace: string;
  readonly serviceRevision: number;
}>;

const selectServiceContext = (state: StateRoot, serviceName: string): ServerConfigServiceContext | null => {
  const slice = state[serverConfigSliceName] as ServerConfigState | undefined;
  if (slice === undefined || !Object.hasOwn(slice.serviceRevisions, serviceName)) return null;
  const serviceRevision = slice.serviceRevisions[serviceName];
  if (typeof slice.selectedSpace !== 'string' || !Number.isSafeInteger(serviceRevision) || serviceRevision < 0)
    return null;
  return Object.freeze({selectedSpace: slice.selectedSpace, serviceRevision});
};

export const selectServerConfigServiceContext = defineStateSelector(moduleName, 'selectServerConfigServiceContext', {
  parameters: [
    {
      kind: 'object',
      properties: {serviceName: {kind: 'string'}},
    },
  ],
  selector: (state: StateRoot, input: Readonly<{serviceName: string}>) =>
    selectServiceContext(state, input.serviceName),
});
