import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {ActivateTerminalPayload, CancelTerminaActivationPayload, TerminalTransportEvent} from '../../types/client';

export const activateTerminalCommand = defineCommand<ActivateTerminalPayload>(moduleName, {
  name: 'activate-terminal',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const cancelTerminaActivationCommand = defineCommand<CancelTerminaActivationPayload>(moduleName, {
  name: 'cancel-terminal-activation',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const cancelTerminalOfflineCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'cancel-terminal-offline',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const connectTerminalCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'connect-terminal',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const disconnectTerminalCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'disconnect-terminal',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const initializeTerminalDataClientCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'initialize-terminal-data-client',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const refreshTerminalClientStatusProjectionCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'refresh-status-projection',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const terminalTransportEventCommand = defineCommand<Readonly<{event: TerminalTransportEvent}>>(moduleName, {
  name: 'transport-event',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
export const terminalHeartbeatTickCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'heartbeat-tick',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
