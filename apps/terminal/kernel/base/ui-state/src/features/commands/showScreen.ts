import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

type ShowScreenPayload = Readonly<{
  readonly displayMode: DisplayMode;
  readonly containerKey: string;
  readonly partKey: string;
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
