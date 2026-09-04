import {describe, expect, it} from 'vitest';
import {dependencyModuleNames, devDependencyModuleNames, moduleName} from '../src/index';

describe('sample-console package surface', () => {
  it('keeps the renamed module and current dependency declarations aligned', () => {
    expect(moduleName).toBe('ui.integration.sample-console');
    expect([...dependencyModuleNames].sort()).toEqual([
      'kernel.base.contracts',
      'kernel.base.display-context',
      'kernel.base.platform-ports',
      'kernel.base.runtime',
      'kernel.base.state',
      'kernel.base.ui-state',
      'ui.base.admin-shell',
      'ui.base.automation',
      'ui.base.input',
      'ui.base.primitives',
      'ui.base.render',
    ]);
    expect([...devDependencyModuleNames]).toEqual(['ui.base.test-support']);
  });
});
