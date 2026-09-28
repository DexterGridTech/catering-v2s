import {describe, expect, it} from 'vitest';
import {createUiCatalog, selectAvailableParts} from '@catering-v2s/kernel-base-ui-state';
import {definePart} from '../src/index';

const ContractComponent = () => null;

const createContractEnumeration = () => {
  const defined = definePart({
    partKey: 'layer-only-contract-part',
    rendererKey: 'layer-only-contract-renderer',
    containerKeys: [],
    displayModes: ['PRIMARY', 'SECONDARY'] as const,
    workspaces: ['MAIN'] as const,
    instanceModes: ['MASTER'] as const,
    surfaceForm: ['laptop', 'mobile'] as const,
    title: 'layer-only-contract-part',
    description: 'layer-only-contract-part',
    component: ContractComponent,
    layerTier: 'alert',
  });
  const catalog = createUiCatalog([defined.catalogEntry]);
  const available = selectAvailableParts(catalog, 'real-container', {
    displayMode: 'PRIMARY',
    workspace: 'MAIN',
    instanceMode: 'MASTER',
    surfaceForm: 'laptop',
  });
  return Object.freeze({defined, catalog, available});
};

describe('render and ui-state catalog contract', () => {
  it('T-13 excludes a layer-only declaration from a real container enumeration', () => {
    const {available} = createContractEnumeration();
    expect(available).toEqual([]);
  });

  it('R-19 preserves the empty containerKeys transfer across the real package boundary', () => {
    const {defined, catalog, available} = createContractEnumeration();
    expect(defined.catalogEntry.containerKeys).toEqual([]);
    expect(catalog.entries[0].containerKeys).toEqual([]);
    expect(available).toEqual([]);
  });
});
