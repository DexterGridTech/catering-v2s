import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state';
import type {TerminalRemoteControlDescription} from '@catering-v2s/kernel-base-terminal-data-client';
import type {RemoteControlScreen} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName} from '../../moduleName';

export const remoteControlSliceName = `${moduleName}.state` as const;
export type RemoteControlReadyScreen = Readonly<{
  endpointId: string;
  screen: RemoteControlScreen;
  streamId: string;
  trackSid: string;
  widthPx: number;
  heightPx: number;
}>;
export type RemoteControlState = Readonly<{
  sessionId: string | null;
  phase: 'idle' | 'starting' | 'active' | 'stopping' | 'ended';
  topologyKind: TerminalRemoteControlDescription['topologyKind'] | null;
  description: TerminalRemoteControlDescription | null;
  localEndpointId: string | null;
  readyScreens: readonly RemoteControlReadyScreen[];
  reason: string | null;
  cleanup: Readonly<{roomLeft: boolean; tracksReleased: number; inputCancelled: boolean}> | null;
}>;

const initialState: RemoteControlState = Object.freeze({
  sessionId: null,
  phase: 'idle',
  topologyKind: null,
  description: null,
  localEndpointId: null,
  readyScreens: Object.freeze([]),
  reason: null,
  cleanup: null,
});
const definition = createSlice({
  name: remoteControlSliceName,
  initialState,
  reducers: {
    replaceSession: (_state, action: PayloadAction<RemoteControlState>): RemoteControlState => action.payload,
  },
});
export const remoteControlActions = definition.actions;
export const remoteControlStateSlice = defineStateRuntimeSlice<RemoteControlState>({
  name: remoteControlSliceName,
  reducer: definition.reducer,
  persistIntent: 'never',
  syncIntent: 'isolated',
});
