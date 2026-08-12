import {describe, expect, it} from 'vitest';
import type {CatalogInventoryEnvelope} from '../../../app/api/generated/catalog-inventory-edge';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import {decodeBrandCopyReadback, decodeDetail, decodeNavigation, decodePreflight} from '../model/catalogModel';

describe('catalog management runtime model contracts', () => {
  it('fails closed when a write request has no selected data-node scope', () => {
    expect(requireOperationsScopeRef({groupWorkspaceKey: 'workspace-1', expectedContextVersion: 3, scopeRef: 'store-1'})).toBe('store-1');
    expect(() => requireOperationsScopeRef({groupWorkspaceKey: 'workspace-1', expectedContextVersion: 3})).toThrow('OPERATIONS_DATA_NODE_SCOPE_REQUIRED');
  });

  it('decodes the canonical catalog detail envelope and rejects an unwrapped detail', () => {
    const decoded = decodeDetail({data: {item: {code: 'TEMP-001', name: '临时商品', source: 'TEMPORARY', externalIdentity: {sourceOrderRef: 'EXT-ORDER-001', sourceRecordRef: 'EXT-RECORD-001', sourceItemRef: 'EXT-SKU-88', snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800}}}, governance: {externalIdentity: null}}} as CatalogInventoryEnvelope);
    expect(decoded?.item.externalIdentity).toMatchObject({sourceOrderRef: 'EXT-ORDER-001', sourceRecordRef: 'EXT-RECORD-001', sourceItemRef: 'EXT-SKU-88', snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800}});
    const unwrapped = decodeDetail({item: {code: 'LATTE-001', name: '拿铁', source: 'CATALOG', status: 'ENABLED', shapeKey: 'STANDARD_SALE_COUNTED'}, tabs: [{tabKey: 'basic', visible: true, disabled: false, reason: null}]} as CatalogInventoryEnvelope);
    expect(unwrapped).toBeUndefined();
  });

  it('keeps brand-copy reference readbacks label-only after decoding', () => {
    const preflight = decodePreflight({data: {preflightDigest: 'digest', selectedCount: 1, selectedLimit: 20, closureCount: 1, closureLimit: 500, blockingCount: 0, confirmationRequiredCount: 0, selectedItems: [], closureItems: [], objectVersions: [], compatibilityResults: [], referenceMappings: [{objectType: 'OPTION_VALUE_BOM', sourceRef: '11111111-1111-1111-1111-111111111111', targetRef: '22222222-2222-2222-2222-222222222222', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L', targetOptionValueCode: 'HOT'}]}} as CatalogInventoryEnvelope);
    expect(preflight?.referenceMappings).toEqual([{objectType: 'OPTION_VALUE_BOM', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L', targetOptionValueCode: 'HOT'}]);

    const readback = decodeBrandCopyReadback({data: {preflightDigest: 'digest', created: [], reused: [], targetVersions: [{targetRef: '33333333-3333-3333-3333-333333333333', version: 2}], ownerReadbacks: [], referenceMappings: [{objectType: 'SKU_BOM', sourceRef: '44444444-4444-4444-4444-444444444444', targetRef: '55555555-5555-5555-5555-555555555555', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L', targetOptionValueCode: null}]}} as CatalogInventoryEnvelope);
    expect(readback?.referenceMappings).toEqual([{objectType: 'SKU_BOM', targetCode: 'LATTE-001', targetSkuCode: 'LATTE-001-L'}]);
    expect(readback?.targetVersions).toEqual([{version: 2}]);
  });

  it('decodes category navigation from the canonical envelope', () => {
    const envelope = {data: {tree: [{categoryRef: 'a0f5f2c9-3e80-4e10-9ecf-a6d8186dfd49', code: 'CAT-ROOT', name: '根类', parentCategoryRef: null, version: 3, displayOrder: 0, count: 2, countSemantics: 'SELF_ONLY', deletionAvailability: {canDelete: false, subtreeSize: 2, blockingReferenceCount: 1, blockingReferenceLabels: ['烤鸡翅(APP-CHICKEN-WINGS-001)']}}], smartViews: [], shapeCounts: [], generation: 7}} as CatalogInventoryEnvelope;
    const node = decodeNavigation(envelope).tree[0];
    expect(node.parentCategoryRef).toBeNull();
    expect(node).toMatchObject({categoryRef: 'a0f5f2c9-3e80-4e10-9ecf-a6d8186dfd49', name: '根类', version: 3, displayOrder: 0, countSemantics: 'SELF_ONLY', deletionAvailability: {canDelete: false, subtreeSize: 2, blockingReferenceCount: 1, blockingReferenceLabels: ['烤鸡翅(APP-CHICKEN-WINGS-001)']}});
  });
});
