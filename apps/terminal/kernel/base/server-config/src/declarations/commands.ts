import {defineCommand} from '@catering-v2s/kernel-base-runtime';

import {moduleName} from '../moduleName';

import {type SetServerOverridePayload} from '../types/serverConfig';

export type SelectServerConfigSpacePayload = Readonly<{
  spaceName: string;
}>;

export const selectServerConfigSpaceCommand = defineCommand<SelectServerConfigSpacePayload>(moduleName, {
  name: 'select-space',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export type ValidateHydratedServerConfigPayload = Readonly<Record<string, never>>;

export const validateHydratedServerConfigCommand = defineCommand<ValidateHydratedServerConfigPayload>(moduleName, {
  name: 'validate-hydrated-config',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export const setServerOverrideCommand = defineCommand<SetServerOverridePayload>(moduleName, {
  name: 'set-server-override',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export type RestoreServerDefaultsPayload = Readonly<Record<string, never>>;

export const restoreServerDefaultsCommand = defineCommand<RestoreServerDefaultsPayload>(moduleName, {
  name: 'restore-defaults',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export type ClearServerOverridePayload = Readonly<{
  serverName: string;
}>;

export const clearServerOverrideCommand = defineCommand<ClearServerOverridePayload>(moduleName, {
  name: 'clear-server-override',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
