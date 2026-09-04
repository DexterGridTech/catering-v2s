import {describe, expect, it} from 'vitest';
import {createSampleAssembly, dependencyModuleNames, devDependencyModuleNames, moduleName, terminalSurfaces} from '../src/index';

describe('sample-console package surface', () => {
  it('keeps the renamed module and current dependency declarations aligned', () => {
    expect(moduleName).toBe('ui.integration.sample-console');
    expect([...dependencyModuleNames].sort()).toEqual([
      'kernel.base.contracts',
      'kernel.base.display-context',
      'kernel.base.platform-ports',
      'kernel.base.runtime',
      'kernel.base.ui-state',
      'kernel.feature.sample-member-registry',
      'kernel.feature.sample-staff-session',
      'ui.base.render',
      'ui.feature.sample-member-desk',
      'ui.feature.sample-staff-auth',
    ]);
    expect([...devDependencyModuleNames]).toEqual(['ui.base.test-support']);
    expect(terminalSurfaces).toEqual({
      layout: 'column',
      scaleToFit: true,
      surfaces: {
        PRIMARY: {width: 1920, height: 1080},
        SECONDARY: {width: 1024, height: 600},
      },
    });
    expect(typeof createSampleAssembly).toBe('function');
  });
});
