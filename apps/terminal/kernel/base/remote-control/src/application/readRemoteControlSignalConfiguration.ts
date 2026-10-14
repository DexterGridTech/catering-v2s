import {
  resolveServerNetworkSnapshot,
  selectServerConfiguration,
  type ServerConfigDefaults,
} from '@catering-v2s/kernel-base-server-config';
import type {StateRoot} from '@catering-v2s/kernel-base-state';

const signalServerName = 'livekit';

export const readRemoteControlSignalConfiguration = (
  state: StateRoot,
  serverSpaces: ServerConfigDefaults,
): Readonly<{url: string; identity: string}> | null => {
  const snapshot = resolveServerNetworkSnapshot(state, serverSpaces, signalServerName);
  const url = snapshot.addresses[0]?.baseUrl;
  if (url === undefined) return null;
  return Object.freeze({
    url,
    identity: `${selectServerConfiguration(state, serverSpaces).selectedSpace}:${snapshot.revision}`,
  });
};
