import {describe, expect, it} from 'vitest';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {
  createServerConfigModule,
  dependencyModuleNames,
  moduleKind,
  moduleName,
  runtimeModuleDependencyNames,
} from '../src/index';

const defaults: TransportServerConfig = {
  selectedSpace: 'dev',
  spaces: [
    {
      name: 'dev',
      servers: [
        {serverName: 'business', addresses: [{addressName: 'primary', baseUrl: 'https://business.example.test'}]},
      ],
    },
  ],
};

describe('server-config package identity', () => {
  it('declares its owner and one-way base dependencies', () => {
    expect(moduleName).toBe('kernel.base.server-config');
    expect(moduleKind).toBe('owner');
    expect(dependencyModuleNames).toEqual(['kernel.base.contracts', 'kernel.base.runtime', 'kernel.base.state']);
    expect(runtimeModuleDependencyNames).toEqual(['kernel.base.runtime']);
    const module = createServerConfigModule(defaults);
    expect(module.dependencies).toEqual([{moduleName: 'kernel.base.runtime'}]);
    expect(module.commandDefinitions?.map(command => command.commandName)).toContain(
      'kernel.base.server-config.set-server-override',
    );
    expect(module.stateSlices).toHaveLength(1);
  });
});
