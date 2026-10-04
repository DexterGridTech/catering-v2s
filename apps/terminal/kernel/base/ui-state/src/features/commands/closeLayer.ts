import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

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
