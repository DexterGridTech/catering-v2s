import {describe, expect, it} from 'vitest';
import type {CatalogOrderOptionDefinitionList, Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {hydrateOrderOptionDefinitionValues, serializeOrderOptionDefinitionValues} from './catalogDefinitionForm';

const uuid = (value: string) => value as Uuid;
const gramSnapshot = {
  unitRef: uuid('00000000-0000-4000-8000-000000000041'),
  code: 'GRAM',
  name: '克',
  unitDimension: 'WEIGHT',
  precision: 0,
} as const;

describe('order option definition form values', () => {
  it('round-trips every associated material instead of keeping only the first row', () => {
    const source = [
      {
        valueRef: uuid('00000000-0000-4000-8000-000000000001'),
        code: 'TRUFFLE',
        name: '黑松露酱',
        displayOrder: 1,
        materials: [
          {
            materialRef: uuid('00000000-0000-4000-8000-000000000011'),
            materialItemRef: uuid('00000000-0000-4000-8000-000000000021'),
            materialItemName: '鸡蛋',
            stockTargetRef: uuid('00000000-0000-4000-8000-000000000031'),
            consumptionUnitSnapshot: gramSnapshot,
          },
          {
            materialRef: uuid('00000000-0000-4000-8000-000000000012'),
            materialItemRef: uuid('00000000-0000-4000-8000-000000000022'),
            materialItemName: '沙拉酱',
            stockTargetRef: uuid('00000000-0000-4000-8000-000000000032'),
            consumptionUnitSnapshot: gramSnapshot,
          },
        ],
      },
    ] satisfies CatalogOrderOptionDefinitionList['data']['definitions'][number]['values'];

    const formValues = hydrateOrderOptionDefinitionValues(source);

    expect(formValues[0].materials).toEqual([
      {materialItemRef: '00000000-0000-4000-8000-000000000021'},
      {materialItemRef: '00000000-0000-4000-8000-000000000022'},
    ]);
    expect(serializeOrderOptionDefinitionValues(formValues)).toEqual([
      {
        valueRef: '00000000-0000-4000-8000-000000000001',
        code: 'TRUFFLE',
        name: '黑松露酱',
        displayOrder: 1,
        materials: [
          {materialItemRef: '00000000-0000-4000-8000-000000000021'},
          {materialItemRef: '00000000-0000-4000-8000-000000000022'},
        ],
      },
    ]);
  });
});
