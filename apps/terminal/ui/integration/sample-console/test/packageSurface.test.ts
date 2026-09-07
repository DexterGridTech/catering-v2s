import {describe, expect, it} from 'vitest';
import {createSampleAssembly, createSurfaceForDisplayIndex, dependencyModuleNames, devDependencyModuleNames, moduleName, terminalSurfaces} from '../src/index';

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
    'ui.base.input',
    'ui.base.render',
      'ui.feature.sample-member-desk',
      'ui.feature.sample-staff-auth',
    ]);
    expect([...devDependencyModuleNames]).toEqual(['ui.base.dev-host']);
    expect(terminalSurfaces).toEqual({
      layout: 'column',
      scaleToFit: true,
      surfaces: {
        PRIMARY: {width: 1157, height: 723},
        SECONDARY: {width: 962, height: 541},
      },
    });
    expect(typeof createSampleAssembly).toBe('function');
    expect(typeof createSurfaceForDisplayIndex).toBe('function');
  });
});
