import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {remoteControlSliceName, type RemoteControlState} from '../features/slices/remoteControl';

export const readRemoteControlState = (state: StateRoot): RemoteControlState => {
  const value = state[remoteControlSliceName];
  if (value === undefined || value === null) throw new Error('REMOTE_CONTROL_STATE_MISSING');
  return value as RemoteControlState;
};
