import {describe, expect, it} from 'vitest';
import {
  createTerminalDataClientModule,
  dependencyModuleNames,
  moduleKind,
  moduleName,
  runtimeModuleDependencyNames,
} from '../src/index';

const createDependencies = () => ({
  businessServerName: 'terminal-business-api',
  transport: {
    start: async () => ({send: async () => undefined, subscribe: () => () => undefined}),
    ready: async () => undefined,
    invalid: async () => undefined,
    stop: async () => undefined,
    executeHttp: async () => ({kind: 'failure' as const, category: 'not-delivered' as const, code: 'test'}),
    reportHttpAddressAvailable: async () => undefined,
  },
  createCredentialSecret: () => 'A'.repeat(43),
  now: () => 1,
  appVersion: 'test',
});

describe('terminal-data-client package identity', () => {
  it('owns protocol and credential behavior while depending only on the generic transport mechanism', () => {
    expect(moduleName).toBe('kernel.base.terminal-data-client');
    expect(moduleKind).toBe('owner');
    expect(dependencyModuleNames).toEqual([
      'kernel.base.contracts',
      'kernel.base.platform-ports',
      'kernel.base.runtime',
      'kernel.base.state',
      'kernel.base.transport',
    ]);
    expect(dependencyModuleNames).not.toContain('kernel.base.server-config');
    expect(runtimeModuleDependencyNames).toEqual(['kernel.base.runtime', 'kernel.base.transport']);
    const module = createTerminalDataClientModule(createDependencies());
    expect(module.dependencies).toEqual([{moduleName: 'kernel.base.runtime'}, {moduleName: 'kernel.base.transport'}]);
    expect(module.commands?.map(command => command.name)).toEqual([
      `${moduleName}.activate-terminal`,
      `${moduleName}.cancel-terminal-online`,
      `${moduleName}.cancel-terminal-offline`,
      `${moduleName}.connect-terminal`,
      `${moduleName}.disconnect-terminal`,
      `${moduleName}.transport-event`,
      `${moduleName}.heartbeat-tick`,
    ]);
    expect(module.slices).toEqual([{name: `${moduleName}.client`, persistIntent: 'owner-only'}]);
  });
});
