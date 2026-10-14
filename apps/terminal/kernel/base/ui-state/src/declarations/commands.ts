import {type DisplayMode} from '@catering-v2s/kernel-base-display-context';

import {type StateJsonValue, type WorkspaceKey} from '@catering-v2s/kernel-base-state';

import {defineCommand} from '@catering-v2s/kernel-base-runtime';

import {moduleName} from '../moduleName';

import {type UiVariableWrite} from '../types/variable';

type ShowScreenPayload = Readonly<{
  readonly displayMode: DisplayMode;
  readonly containerKey: string;
  readonly partKey: string;
  readonly workspace?: WorkspaceKey;
  readonly instanceId?: string;
  readonly props?: StateJsonValue;
}>;

export const showScreenCommand = defineCommand<ShowScreenPayload>(moduleName, {
  name: 'show-screen',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type PruneHydratedContainersPayload = Readonly<Record<string, never>>;

/** Install-only reconciliation of hydrated screen containers against the module catalog. */
export const pruneHydratedContainersCommand = defineCommand<PruneHydratedContainersPayload>(moduleName, {
  name: 'prune-hydrated-containers',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type SetUiVariablesPayload = Readonly<{
  readonly entries: readonly UiVariableWrite<StateJsonValue>[];
}>;

export const setUiVariablesCommand = defineCommand<SetUiVariablesPayload>(moduleName, {
  name: 'set-ui-variables',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type OpenLayerPayload = Readonly<{
  readonly displayMode: DisplayMode;
  readonly layerId: string;
  readonly partKey: string;
  readonly props?: StateJsonValue;
  readonly persistence?: 'durable' | 'ephemeral';
  readonly workspace?: WorkspaceKey;
}>;

export const openLayerCommand = defineCommand<OpenLayerPayload>(moduleName, {
  name: 'open-layer',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type CloseLayerPayload = Readonly<{
  readonly displayMode: DisplayMode;
  readonly layerId: string;
  readonly workspace?: WorkspaceKey;
}>;

export const closeLayerCommand = defineCommand<CloseLayerPayload>(moduleName, {
  name: 'close-layer',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type ClearLayersPayload = Readonly<{
  readonly displayMode: DisplayMode;
}>;

export const clearLayersCommand = defineCommand<ClearLayersPayload>(moduleName, {
  name: 'clear-layers',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type PruneHydratedLayersPayload = Readonly<Record<string, never>>;

/** Install-only reconciliation of hydrated layer membership against the module catalog. */
export const pruneHydratedLayersCommand = defineCommand<PruneHydratedLayersPayload>(moduleName, {
  name: 'prune-hydrated-layers',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type ClearUiVariablesPayload = Readonly<{
  readonly keys: readonly string[];
}>;

export const clearUiVariablesCommand = defineCommand<ClearUiVariablesPayload>(moduleName, {
  name: 'clear-ui-variables',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
