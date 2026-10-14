import {defineCommand, type RuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';

import {moduleName} from '../moduleName';

import {type DisplayRole, type PowerSource} from '../types/display';

export type CancelPowerRoleChangePayload = Readonly<{}>;

export const cancelPowerRoleChangeCommand = defineCommand<CancelPowerRoleChangePayload>(moduleName, {
  name: 'cancel-power-role-change',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export type ConfirmPowerRoleChangePayload = Readonly<{
  readonly powerSource: PowerSource;
  readonly targetRole: DisplayRole;
}>;

export const confirmPowerRoleChangeCommand = defineCommand<ConfirmPowerRoleChangePayload>(moduleName, {
  name: 'confirm-power-role-change',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type SwitchDisplayRolePayload = Readonly<{
  displayRole: DisplayRole;
}>;

export const switchDisplayRoleCommand = defineCommand<SwitchDisplayRolePayload>(moduleName, {
  name: 'switch-display-role',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type PowerStatusChangedPayload = Readonly<{
  powerSource: PowerSource;
}>;

export const powerStatusChangedCommand = defineCommand<PowerStatusChangedPayload>(moduleName, {
  name: 'power-status-changed',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export type RequestPowerRoleChangePayload = Readonly<{
  readonly powerSource: PowerSource;
}>;

export const requestPowerRoleChangeCommand = defineCommand<RequestPowerRoleChangePayload>(moduleName, {
  name: 'request-power-role-change',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type ValidateHydratedDisplayRolePayload = Readonly<{}>;

export const validateHydratedDisplayRoleCommand = defineCommand<ValidateHydratedDisplayRolePayload>(moduleName, {
  name: 'validate-hydrated-display-role',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

type SwitchInstanceModePayload = Readonly<{
  instanceMode: RuntimeInstanceMode;
}>;

export const switchInstanceModeCommand = defineCommand<SwitchInstanceModePayload>(moduleName, {
  name: 'switch-instance-mode',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
