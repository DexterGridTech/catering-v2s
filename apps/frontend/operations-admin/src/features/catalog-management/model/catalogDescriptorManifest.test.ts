import {describe, expect, it} from 'vitest';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogJoinedField} from './catalogDescriptorManifest';

describe('catalog descriptor manifest adapter', () => {
  it('joins categoryRef from the generated field and shape rule instead of a local control definition', () => {
    const manifest = {
      fields: [
        {
          fieldKey: 'categoryRef',
          dataPath: 'categoryRef',
          label: '所属分类',
          controlKind: 'treeSelect',
          tabKey: 'basic',
          admittedShapes: ['STANDARD_SALE_COUNTED'],
          helpText: '选择商品所属分类。',
          optionSourceRef: {
            kind: 'endpoint',
            operationId: 'getOperationsCatalogCategoryCandidates',
            itemsPath: 'data.items',
            valueField: 'categoryRef',
            labelField: 'name',
            parentField: 'parentCategoryRef',
            disabledWhen: null,
          },
        },
      ],
      fieldRules: {
        STANDARD_SALE_COUNTED: [{field: 'categoryRef', visible: true, readonly: false, readonlyWhen: {update: false}}],
      },
      tabRules: {STANDARD_SALE_COUNTED: {visible: ['basic']}},
    } as unknown as Pick<CatalogShapeManifestView, 'fields' | 'fieldRules' | 'tabRules'>;
    const field = catalogJoinedField(manifest, 'STANDARD_SALE_COUNTED', 'categoryRef');
    expect(field).toMatchObject({
      fieldKey: 'categoryRef',
      controlKind: 'treeSelect',
      tabKey: 'basic',
      rule: {field: 'categoryRef'},
      readonly: false,
    });
    expect(field?.optionSourceRef).toMatchObject({
      kind: 'endpoint',
      operationId: 'getOperationsCatalogCategoryCandidates',
      parentField: 'parentCategoryRef',
    });
  });
});
