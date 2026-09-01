import {describe, expect, it} from 'vitest';
import type {CatalogCandidateRow} from './catalogFieldRuntime';
import {draftUuid, type SkuDimensionDraft} from './catalogItemEditorDraftAdapters';
import {
  reconcileSkuDimensionValuesFromSelection,
  reconcileSkuDimensionsFromSelection,
} from './catalogSkuSpecificationDraft';

function candidate(entryRef: string, code: string, name: string, status = 'ENABLED'): CatalogCandidateRow {
  return {entryRef, code, name, status};
}

describe('catalog SKU specification selection reconciliation', () => {
  it('maps one ordered attribute-library selection to stable compact dimension drafts', () => {
    const existing: SkuDimensionDraft = {
      editorId: 'dimension-existing',
      attributeRef: draftUuid('attribute-size'),
      attributeCode: 'SIZE',
      attributeName: '尺寸',
      values: [
        {
          editorId: 'value-existing',
          valueRef: draftUuid('value-small'),
          valueCode: 'SMALL',
          valueLabel: '小杯',
          displayOrder: 0,
          status: 'ENABLED',
        },
      ],
    };
    let sequence = 0;
    const nextId = (prefix: string) => `${prefix}-${++sequence}`;

    const selected = reconcileSkuDimensionsFromSelection(
      [existing],
      ['attribute-size', 'attribute-temperature'],
      [candidate('attribute-size', 'SIZE', '尺寸'), candidate('attribute-temperature', 'TEMP', '温度')],
      nextId,
    );

    expect(selected.map(dimension => dimension.attributeRef)).toEqual(['attribute-size', 'attribute-temperature']);
    expect(selected.map(dimension => dimension.attributeName)).toEqual(['尺寸', '温度']);
    expect(selected[0]?.editorId).toBe('dimension-existing');
    expect(selected[0]?.values[0]?.editorId).toBe('value-existing');
    expect(selected[1]?.editorId).toBe('dimension-1');

    const reordered = reconcileSkuDimensionsFromSelection(
      selected,
      ['attribute-temperature', 'attribute-size'],
      [candidate('attribute-size', 'SIZE', '尺寸'), candidate('attribute-temperature', 'TEMP', '温度')],
      nextId,
    );
    expect(reordered.map(dimension => dimension.attributeRef)).toEqual(['attribute-temperature', 'attribute-size']);
    expect(reordered.map(dimension => dimension.editorId)).toEqual(['dimension-1', 'dimension-existing']);
  });

  it('maps one dimension value multi-selection and takes lifecycle from dictionary candidates', () => {
    let sequence = 0;
    const selected = reconcileSkuDimensionValuesFromSelection(
      [],
      ['value-hot', 'value-iced'],
      [candidate('value-hot', 'HOT', '热'), candidate('value-iced', 'ICED', '冰')],
      prefix => `${prefix}-${++sequence}`,
    );

    expect(selected).toMatchObject([
      {
        valueRef: 'value-hot',
        valueCode: 'HOT',
        valueLabel: '热',
        displayOrder: 0,
        status: 'ENABLED',
      },
      {
        valueRef: 'value-iced',
        valueCode: 'ICED',
        valueLabel: '冰',
        displayOrder: 1,
        status: 'ENABLED',
      },
    ]);
    expect(selected.map(value => value.editorId)).toEqual(['dimension-value-1', 'dimension-value-2']);
  });
});
