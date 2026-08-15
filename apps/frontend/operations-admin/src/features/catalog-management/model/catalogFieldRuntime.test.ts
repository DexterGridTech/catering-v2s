import {describe, expect, it} from 'vitest';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import {assertCatalogOptionBindingSet, CATALOG_OPTION_OPERATION_IDS, catalogFieldFingerprint, createCatalogOptionResolver} from './catalogFieldRuntime';

const source = {kind: 'endpoint' as const, operationId: 'getOperationsCatalogDictionary' as const, path: {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'}, query: {dataNodeRef: {context: 'scope.dataNodeRef'}}, itemsPath: 'data.entries', valueField: 'entryRef', labelField: 'name', contextBindings: {attributeRef: {fieldKey: 'skuVariantAttribute'}}};
function context(attribute: string, revision = 1, brandRef = 'brand-a') {
  return {scope: {dataNodeRef: '00000000-0000-4000-8000-000000000001' as never, brandRef}, readField: () => attribute, readSection: () => [], sectionRevision: () => revision};
}

describe('catalog descriptor field runtime', () => {
  it('requires the manifest endpoint operation set to equal the generated binding set', () => {
    const manifest = {
      fields: CATALOG_OPTION_OPERATION_IDS.map((operationId) => ({optionSourceRef: {kind: 'endpoint' as const, operationId}})),
    };
    expect(() => assertCatalogOptionBindingSet(manifest as Pick<CatalogShapeManifestView, 'fields'>)).not.toThrow();
    expect(() => assertCatalogOptionBindingSet({fields: manifest.fields.slice(0, -1)} as Pick<CatalogShapeManifestView, 'fields'>)).toThrow('CATALOG_OPTION_OPERATION_BINDING_SET_MISMATCH');
  });

  it('keeps the endpoint binding denominator explicit and fingerprints context, sections and scope', () => {
    expect(CATALOG_OPTION_OPERATION_IDS).toHaveLength(5);
    const first = catalogFieldFingerprint(source, context('TASTE'));
    expect(catalogFieldFingerprint(source, context('SIZE'))).not.toBe(first);
    expect(catalogFieldFingerprint(source, context('TASTE', 2))).not.toBe(first);
    expect(catalogFieldFingerprint(source, context('TASTE', 1, 'brand-b'))).not.toBe(first);
  });

  it('does not let a late endpoint response replace a newer context result', async () => {
    const pending: Array<(value: unknown) => void> = [];
    const resolver = createCatalogOptionResolver(async () => new Promise((resolve) => pending.push(resolve)));
    const first = resolver(source, context('A'));
    const second = resolver(source, context('B'));
    pending[1]({data: {entries: [{entryRef: 'b-ref', name: 'B', status: 'ENABLED'}]}});
    pending[0]({data: {entries: [{entryRef: 'a-ref', name: 'A', status: 'ENABLED'}]}});
    await expect(second).resolves.toMatchObject({stale: false, options: [{value: 'b-ref', label: 'B'}]});
    await expect(first).resolves.toMatchObject({stale: true, options: []});
  });

  it('recomputes local candidates from the section rather than issuing a request', async () => {
    const resolver = createCatalogOptionResolver();
    const result = await resolver({kind: 'local', sectionPath: 'orderOptions', valueField: 'attributeValueRef', labelField: 'name'}, {
      ...context('unused'),
      readSection: () => [{attributeValueRef: 'value-a', name: '加辣'}],
    });
    expect(result).toMatchObject({stale: false, options: [{value: 'value-a', label: '加辣'}]});
    expect(result.rows).toEqual([{attributeValueRef: 'value-a', name: '加辣'}]);
  });

  it('flattens nested order-options values without turning the local source into an endpoint', async () => {
    const resolver = createCatalogOptionResolver();
    const result = await resolver({kind: 'local', sectionPath: 'orderOptions', valueField: 'attributeValueRef', labelField: 'name'}, {
      ...context('unused'),
      readSection: () => [{groupCode: 'TEMP', values: [{attributeValueRef: 'value-a', name: '加辣'}, {attributeValueRef: 'value-b', name: '加葱'}]}],
    });
    expect(result.options).toEqual([{value: 'value-a', label: '加辣', disabled: false}, {value: 'value-b', label: '加葱', disabled: false}]);
    expect(result.rows).toEqual([{attributeValueRef: 'value-a', name: '加辣'}, {attributeValueRef: 'value-b', name: '加葱'}]);
  });

  it('keeps independently mounted picker resolvers from invalidating one another', async () => {
    const pending: Array<(value: unknown) => void> = [];
    const firstResolver = createCatalogOptionResolver(async () => new Promise((resolve) => pending.push(resolve)));
    const secondResolver = createCatalogOptionResolver(async () => new Promise((resolve) => pending.push(resolve)));
    const first = firstResolver(source, context('first'));
    const second = secondResolver(source, context('second'));
    pending[0]({data: {entries: [{entryRef: 'first-ref', name: '第一项', status: 'ENABLED'}]}});
    pending[1]({data: {entries: [{entryRef: 'second-ref', name: '第二项', status: 'ENABLED'}]}});
    await expect(first).resolves.toMatchObject({stale: false, options: [{value: 'first-ref', label: '第一项'}]});
    await expect(second).resolves.toMatchObject({stale: false, options: [{value: 'second-ref', label: '第二项'}]});
  });

  it('maps the navigation parent field into descriptor tree data without losing flat values', async () => {
    const navigationSource = {
      kind: 'endpoint' as const,
      operationId: 'getOperationsCatalogNavigation' as const,
      path: {},
      query: {viewKey: 'ALL'},
      itemsPath: 'data.tree',
      valueField: 'categoryRef',
      labelField: 'name',
      parentField: 'parentCategoryRef',
      disabledWhen: null,
    };
    const resolver = createCatalogOptionResolver(async () => ({data: {tree: [
      {categoryRef: 'root', name: '饮品', parentCategoryRef: null},
      {categoryRef: 'child', name: '咖啡', parentCategoryRef: 'root'},
    ]}}));
    const result = await resolver(navigationSource, context('unused'));
    expect(result.options).toEqual([{value: 'root', label: '饮品', disabled: false}, {value: 'child', label: '咖啡', disabled: false}]);
    expect(result.treeData).toEqual([{key: 'root', value: 'root', title: '饮品', disabled: false, children: [{key: 'child', value: 'child', title: '咖啡', disabled: false}]}]);
  });
});
