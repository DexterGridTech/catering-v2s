import {describe, expect, it} from 'vitest';
import consolePackage from '../../../apps/terminal/application/android/sample-terminal/package.json';
import wallpaperPackage from '../../../apps/terminal/application/android/sample-wallpaper-terminal/package.json';
import {resolveManagedServerSpaces} from '../../../apps/terminal/application/android/sample-terminal/src/assembly/managedServerSpaces.ts';
import {resolveManagedServerSpaces as resolveWallpaperServerSpaces} from '../../../apps/terminal/application/android/sample-wallpaper-terminal/src/assembly/managedServerSpaces.ts';
import {parseServerConfigEnvironment} from '../src/serverConfigEnvironment.ts';

const config = (groupWorkspaceKey = 'dev-group') =>
  JSON.stringify({
    spaceName: 'development',
    servers: [
      {
        serverName: 'business',
        addresses: [
          {
            addressName: 'primary',
            baseUrl: `http://127.0.0.1:28080/api/terminal/group-workspaces/${groupWorkspaceKey}`,
          },
        ],
      },
      {
        serverName: 'terminal-data-server',
        addresses: [
          {addressName: 'haproxy-entry-one', baseUrl: 'ws://127.0.0.1:28180'},
          {addressName: 'haproxy-entry-two', baseUrl: 'ws://127.0.0.1:28181'},
        ],
      },
    ],
  });

describe('managed DEV server-config wiring for Android entries', () => {
  it('keeps each application default set independent and resolves the managed named replacements', () => {
    expect(resolveManagedServerSpaces(consolePackage.serverSpaces, undefined)).toBe(consolePackage.serverSpaces);
    expect(resolveWallpaperServerSpaces(wallpaperPackage.serverSpaces, undefined)).toBe(wallpaperPackage.serverSpaces);

    const consoleConfig = resolveManagedServerSpaces(consolePackage.serverSpaces, config());
    const wallpaperConfig = resolveWallpaperServerSpaces(wallpaperPackage.serverSpaces, config());
    for (const resolved of [consoleConfig, wallpaperConfig]) {
      const selected = resolved.spaces.find(space => space.name === resolved.selectedSpace);
      expect(selected?.servers.find(server => server.serverName === 'business')?.addresses[0]?.baseUrl).toBe(
        'http://127.0.0.1:28080/api/terminal/group-workspaces/dev-group',
      );
      expect(
        selected?.servers.find(server => server.serverName === 'terminal-data-server')?.addresses.map(value => value.baseUrl),
      ).toEqual(['ws://127.0.0.1:28180', 'ws://127.0.0.1:28181']);
      expect(selected?.servers.find(server => server.serverName === 'livekit')?.addresses[0]?.baseUrl).toBe(
        'ws://47.106.121.27:7880',
      );
    }
  });

  it('derives the activation group from the configured business address rather than a fixed fixture key', () => {
    const environment = parseServerConfigEnvironment(config('another-group'));
    expect(environment.servers[0]?.addresses[0]?.baseUrl).toContain('/group-workspaces/another-group');
  });
});
