import {describe, expect, it} from 'vitest';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogJoinedField} from './catalogDescriptorManifest';

describe('catalog descriptor manifest adapter', () => {
  it('joins categoryRefs from the generated field and shape rule instead of a local control definition', () => {
    const manifest = {
      fields: [{fieldKey: 'categoryRefs', dataPath: 'categoryRefs[]', label: '所属分类', controlKind: 'treeSelect', tabKey: 'basic', admittedShapes: ['STANDARD_SALE_COUNTED'], helpText: '选择商品所属分类。', optionSourceRef: {kind: 'endpoint', operationId: 'getOperationsCatalogNavigation', itemsPath: 'data.tree', valueField: 'categoryRef', labelField: 'name', parentField: 'parentCategoryRef', disabledWhen: null}}],
      fieldRules: {STANDARD_SALE_COUNTED: [{field: 'categoryRefs', visible: true, readonly: false, readonlyWhen: {update: false}}]},
      tabRules: {STANDARD_SALE_COUNTED: {visible: ['basic']}},
    } as unknown as Pick<CatalogShapeManifestView, 'fields' | 'fieldRules' | 'tabRules'>;
    const field = catalogJoinedField(manifest, 'STANDARD_SALE_COUNTED', 'categoryRefs');
    expect(field).toMatchObject({fieldKey: 'categoryRefs', controlKind: 'treeSelect', tabKey: 'basic', rule: {field: 'categoryRefs'}, readonly: false});
    expect(field?.optionSourceRef).toMatchObject({kind: 'endpoint', operationId: 'getOperationsCatalogNavigation', parentField: 'parentCategoryRef'});
  });
});
