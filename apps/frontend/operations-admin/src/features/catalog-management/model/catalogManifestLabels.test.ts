import {describe, expect, it} from 'vitest';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogEnumLabel, catalogEnumOptions, catalogFieldHelpText, catalogFieldLabel} from './catalogManifestLabels';

const manifest = {
  enumLabels: {shapeKey: {STANDARD_SALE_COUNTED: '普通销售商品', MATERIAL: '原材料'}},
  fields: [{fieldKey: 'categoryRefs', label: '分类', helpText: '选择商品所属分类。'}],
} as unknown as Pick<CatalogShapeManifestView, 'enumLabels' | 'fields'>;

describe('catalog manifest label bindings', () => {
  it('uses manifest labels and exposes unknown values without a frontend mapping table', () => {
    expect(catalogEnumLabel(manifest, 'shapeKey', 'STANDARD_SALE_COUNTED')).toBe('普通销售商品');
    expect(catalogEnumLabel(manifest, 'shapeKey', 'NEW_SHAPE')).toBe('NEW_SHAPE');
    expect(catalogEnumOptions(manifest, 'shapeKey')).toEqual([
      {value: 'STANDARD_SALE_COUNTED', label: '普通销售商品'},
      {value: 'MATERIAL', label: '原材料'},
    ]);
  });

  it('resolves field label and help text by the declared field key', () => {
    expect(catalogFieldLabel(manifest, 'categoryRefs')).toBe('分类');
    expect(catalogFieldHelpText(manifest, 'categoryRefs')).toBe('选择商品所属分类。');
    expect(catalogFieldLabel(manifest, 'notDeclared')).toBe('notDeclared');
  });
});
