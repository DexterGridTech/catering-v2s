import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {StateJsonValue, WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

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
