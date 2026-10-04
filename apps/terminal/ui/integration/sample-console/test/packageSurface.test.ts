import {describe, expect, it} from 'vitest';
import {
  createSampleAssembly,
  createSurfaceForDisplayIndex,
  dependencyModuleNames,
  devDependencyModuleNames,
  moduleName,
  terminalSurfaces,
} from '../src/index';

describe('sample-console package surface', () => {
  it('keeps the renamed module and current dependency declarations aligned', () => {
    expect(moduleName).toBe('ui.integration.sample-console');
    expect([...dependencyModuleNames].sort()).toEqual([
      'kernel.base.contracts',
      'kernel.base.display-context',
      'kernel.base.platform-ports',
      'kernel.base.runtime',
      'kernel.base.server-config',
      'kernel.base.state',
      'kernel.base.terminal-data-client',
      'kernel.base.topology',
      'kernel.base.transport',
      'kernel.base.ui-state',
      'kernel.feature.sample-member-registry',
      'kernel.feature.sample-staff-session',
      'kernel.feature.store-basic',
      'ui.base.admin-shell',
      'ui.base.input',
      'ui.base.integration-assembly',
      'ui.base.render',
      'ui.base.server-config-panel',
      'ui.base.terminal-activation',
      'ui.feature.sample-member-desk',
      'ui.feature.sample-staff-auth',
    ]);
    expect([...devDependencyModuleNames].sort()).toEqual(['ui.base.dev-host', 'ui.base.primitives']);
    expect(terminalSurfaces).toEqual({
      orientations: {
        landscape: {
          PRIMARY: {width: 1280, height: 720},
          SECONDARY: {width: 1280, height: 720},
        },
        portrait: {
          PRIMARY: {width: 360, height: 640},
        },
      },
    });
    expect(typeof createSampleAssembly).toBe('function');
    expect(typeof createSurfaceForDisplayIndex).toBe('function');
  });
});
