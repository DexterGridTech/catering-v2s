import {describe, expect, it} from 'vitest';
import * as uiState from '../src/index';

describe('ui-state package boundary', () => {
  it('owns the package without exposing an accidental value surface', () => {
    expect(uiState.moduleName).toBe('kernel.base.ui-state');
    expect(uiState.moduleKind).toBe('owner');
    expect(Object.keys(uiState).sort()).toEqual([
      'clearLayersCommand',
      'clearUiVariablesCommand',
      'closeLayerCommand',
      'contentStateSliceName',
      'createModuleUiVariableFactory',
      'createUiCatalog',
      'createUiStateModule',
      'createUiVariableWrite',
      'dependencyModuleNames',
      'devDependencyModuleNames',
      'isCurrentWorkspaceOwnedByInstance',
      'isSurfaceForm',
      'isUiCatalogEntryAvailable',
      'isWorkspaceOwnedByInstanceMode',
      'moduleKind',
      'moduleName',
      'openLayerCommand',
      'selectAvailableParts',
      'selectLayers',
      'selectScreen',
      'selectSurfaceForm',
      'setUiVariablesCommand',
      'showScreenCommand',
      'workspaceOwnedByInstanceMode',
    ]);
  });
});
