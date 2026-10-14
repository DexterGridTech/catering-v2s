import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {parseServerConfigEnvironment} from '../src/serverConfigEnvironment';
import {
  resolveServerConfigEnvironment,
} from '@catering-v2s/kernel-base-server-config/environment';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const entryPackages = [
  'apps/terminal/application/android/sample-terminal/package.json',
  'apps/terminal/application/android/sample-wallpaper-terminal/package.json',
  'apps/terminal/ui/integration/sample-console/package.json',
  'apps/terminal/ui/integration/sample-wallpaper-console/package.json',
] as const;

const addressOverrides = {
  servers: [
    {
      serverName: 'business',
      addresses: [
        {
          addressName: 'primary',
          baseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/managed-fixture',
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
} as const;

describe('managed DEV server-config environment wiring', () => {
  it('loads the owner environment API through the managed Node TypeScript runtime', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '--eval',
        "import {parseServerConfigEnvironmentJson, resolveServerConfigEnvironment} from '@catering-v2s/kernel-base-server-config/environment'; if (typeof parseServerConfigEnvironmentJson !== 'function' || typeof resolveServerConfigEnvironment !== 'function') process.exit(2);",
      ],
      {cwd: repositoryRoot, encoding: 'utf8'},
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it.each(entryPackages)('applies one named address set to the independent defaults in %s', packagePath => {
    const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, packagePath), 'utf8')) as {
      readonly serverSpaces: Parameters<typeof resolveServerConfigEnvironment>[0];
    };
    const defaults = packageJson.serverSpaces;
    const environment = parseServerConfigEnvironment(
      JSON.stringify({spaceName: defaults.selectedSpace, servers: addressOverrides.servers}),
    );
    const resolved = resolveServerConfigEnvironment(defaults, environment);
    const selectedSpace = resolved.spaces.find(space => space.name === resolved.selectedSpace);
    const defaultSpace = defaults.spaces.find(space => space.name === defaults.selectedSpace);
    const business = selectedSpace?.servers.find(server => server.serverName === 'business');
    const tds = selectedSpace?.servers.find(server => server.serverName === 'terminal-data-server');
    const livekit = selectedSpace?.servers.find(server => server.serverName === 'livekit');

    expect(resolved.selectedSpace).toBe(defaults.selectedSpace);
    expect(business?.addresses[0]).toMatchObject({
      addressName: 'primary',
      baseUrl: addressOverrides.servers[0].addresses[0].baseUrl,
      timeoutMs: 10_000,
    });
    expect(tds?.addresses.map(address => ({addressName: address.addressName, baseUrl: address.baseUrl}))).toEqual(
      addressOverrides.servers[1].addresses,
    );
    expect(livekit).toEqual(defaultSpace?.servers.find(server => server.serverName === 'livekit'));
  });
});
