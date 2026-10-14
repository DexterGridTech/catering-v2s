import {defineCommand} from '@catering-v2s/kernel-base-runtime';

import {moduleName} from '../moduleName';

import type {
  TerminalRemoteControlDescription,
  TerminalRemoteControlEndpointGrant,
} from '../generated/terminalApi';

export type StartRemoteControlPayload = Readonly<{
  sessionId: string;
  bindingGeneration: number;
  targetSessionId: string;
}>;

export type JoinRemoteControlPayload = Readonly<{
  description: TerminalRemoteControlDescription;
  grant: TerminalRemoteControlEndpointGrant;
}>;

export type StopRemoteControlPayload = Readonly<{
  sessionId: string;
  reason:
    | 'ADMIN_ENDED'
    | 'WORKSPACE_CLOSED'
    | 'START_FAILED'
    | 'START_TIMEOUT'
    | 'CONTROLLER_DISCONNECTED'
    | 'SCREEN_DISCONNECTED'
    | 'PAIR_DISCONNECTED'
    | 'TDP_DISCONNECTED'
    | 'ACTIVATION_INVALID'
    | 'AUTHORIZATION_INVALID'
    | 'CONFIG_CHANGED'
    | 'APP_RESTARTED'
    | 'LEASE_EXPIRED'
    | 'CAPTURE_FAILED'
    | 'INPUT_RESULT_UNKNOWN'
    | 'INPUT_UNAVAILABLE'
    | 'UNSUPPORTED_PROTOCOL';
}>;

export const startRemoteControlCommand = defineCommand<StartRemoteControlPayload>(moduleName, {
  name: 'start-remote-control',
  visibility: 'public',
  timeoutMs: 20000,
  defaultTarget: 'local',
});

export const joinRemoteControlCommand = defineCommand<JoinRemoteControlPayload>(moduleName, {
  name: 'join-remote-control',
  visibility: 'public',
  timeoutMs: 15000,
  defaultTarget: 'local',
});

export const stopRemoteControlCommand = defineCommand<StopRemoteControlPayload>(moduleName, {
  name: 'stop-remote-control',
  visibility: 'public',
  timeoutMs: 15000,
  defaultTarget: 'local',
});

export type RemoteControlPortEventPayload = Readonly<
  Record<string, string | number | boolean | null | readonly (string | number)[]>
>;

export const remoteControlPortEventCommand = defineCommand<RemoteControlPortEventPayload>(moduleName, {
  name: 'port-event',
  visibility: 'internal',
  allowNoActor: true,
  defaultTarget: 'local',
});
