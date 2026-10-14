import {describe, expect, it} from 'vitest';
import {serverConfigSliceName, type ServerConfigDefaults} from '@catering-v2s/kernel-base-server-config';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {readRemoteControlSignalConfiguration} from '../src/application/readRemoteControlSignalConfiguration';

const serverSpaces: ServerConfigDefaults = {
  selectedSpace: 'development',
  spaces: [
    {
      name: 'development',
      servers: [{serverName: 'livekit', addresses: [{addressName: 'primary', baseUrl: 'ws://dev.example'}]}],
    },
    {
      name: 'backup',
      servers: [{serverName: 'livekit', addresses: [{addressName: 'primary', baseUrl: 'ws://backup.example'}]}],
    },
  ],
};

const makeState = (input: Readonly<{selectedSpace?: string; url?: string; revision?: number}> = {}): StateRoot =>
  ({
    [serverConfigSliceName]: {
      selectedSpace: input.selectedSpace ?? 'development',
      overrides:
        input.url === undefined
          ? {}
          : {livekit: {addresses: [{addressName: 'selected', baseUrl: input.url}], proxy: null}},
      proxyPasswords: {},
      syncedHostDefaults: null,
      serviceRevisions: {livekit: input.revision ?? 0},
    },
  }) as unknown as StateRoot;

describe('remote-control signal configuration', () => {
  it('uses server-config selected space, effective address and revision', () => {
    expect(
      readRemoteControlSignalConfiguration(
        makeState({selectedSpace: 'backup', url: 'ws://override.example', revision: 4}),
        serverSpaces,
      ),
    ).toEqual({url: 'ws://override.example', identity: 'backup:4'});
  });

  it('returns unavailable when the effective LiveKit service has no address', () => {
    const emptyAddressDefaults: ServerConfigDefaults = {
      selectedSpace: 'development',
      spaces: [
        {name: 'development', servers: [{serverName: 'livekit', addresses: []}]},
      ],
    };
    expect(readRemoteControlSignalConfiguration(makeState(), emptyAddressDefaults)).toBeNull();
  });
});
