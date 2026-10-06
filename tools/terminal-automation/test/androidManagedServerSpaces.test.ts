import {describe, expect, it} from 'vitest';
import packageJson from '../../../apps/terminal/application/android/sample-terminal/package.json';
import {resolveManagedServerSpaces} from '../../../apps/terminal/application/android/sample-terminal/src/assembly/managedServerSpaces.ts';

const env = (overrides: Partial<Parameters<typeof resolveManagedServerSpaces>[1]> = {}) => ({
  automationBuild: 'true',
  businessBaseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
  tdsEntryOneUrl: 'ws://127.0.0.1:28180',
  tdsEntryTwoUrl: 'ws://127.0.0.1:28181',
  ...overrides,
});

describe('Android managed DEV server-space composition', () => {
  it('keeps package defaults outside the automation build and replaces only the selected space', () => {
    expect(resolveManagedServerSpaces(packageJson.serverSpaces, env({automationBuild: 'false'}))).toBe(
      packageJson.serverSpaces,
    );
    const resolved = resolveManagedServerSpaces(packageJson.serverSpaces, env());
    const selected = resolved.spaces.find(space => space.name === resolved.selectedSpace);
    expect(selected?.servers.find(server => server.serverName === 'business')?.addresses[0]?.baseUrl).toBe(
      'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora',
    );
    expect(
      selected?.servers
        .find(server => server.serverName === 'terminal-data-server')
        ?.addresses.map(value => value.baseUrl),
    ).toEqual(['ws://127.0.0.1:28180/', 'ws://127.0.0.1:28181/']);
  });

  it('rejects partial endpoints, a different business workspace, shared ports, and non-loopback URLs', () => {
    expect(() => resolveManagedServerSpaces(packageJson.serverSpaces, env({tdsEntryTwoUrl: undefined}))).toThrow(
      'TERMINAL_AUTOMATION_MANAGED_SERVER_URLS_INCOMPLETE',
    );
    expect(() =>
      resolveManagedServerSpaces(
        packageJson.serverSpaces,
        env({businessBaseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/other'}),
      ),
    ).toThrow('TERMINAL_AUTOMATION_MANAGED_SERVER_URL_INVALID');
    expect(() =>
      resolveManagedServerSpaces(packageJson.serverSpaces, env({tdsEntryTwoUrl: 'ws://127.0.0.1:28180'})),
    ).toThrow('TERMINAL_AUTOMATION_MANAGED_SERVER_URL_INVALID');
    expect(() =>
      resolveManagedServerSpaces(packageJson.serverSpaces, env({tdsEntryOneUrl: 'ws://example.com:28180'})),
    ).toThrow('TERMINAL_AUTOMATION_MANAGED_SERVER_URL_INVALID');
  });
});
