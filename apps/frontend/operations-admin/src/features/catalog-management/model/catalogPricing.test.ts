import {describe, expect, it} from 'vitest';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogCentsToYuan, catalogDetailImageRefs, catalogYuanToCents} from './catalogModel';

const uuid = (value: string) => value as Uuid;

describe('catalog operator price values', () => {
  it('shows integer-cent wire values as yuan with at most two decimals', () => {
    expect(catalogCentsToYuan(1280)).toBe(12.8);
    expect(catalogCentsToYuan(1299)).toBe(12.99);
    expect(catalogCentsToYuan(null)).toBeUndefined();
  });

  it('round-trips yuan input to integer cents without exposing storage units', () => {
    expect(catalogYuanToCents(12.8)).toBe(1280);
    expect(catalogYuanToCents('12.99')).toBe(1299);
    expect(catalogYuanToCents('')).toBeNull();
    expect(catalogYuanToCents(-1)).toBeNull();
  });

  it('keeps relation-backed detail images ordered and uses the list primary image only as a read fallback', () => {
    expect(
      catalogDetailImageRefs({
        images: [uuid('image-main'), uuid('image-secondary')],
        primaryImageAssetRef: uuid('list-primary'),
      }),
    ).toEqual([uuid('image-main'), uuid('image-secondary')]);
    expect(catalogDetailImageRefs({images: [], primaryImageAssetRef: uuid('list-primary')})).toEqual([
      uuid('list-primary'),
    ]);
    expect(catalogDetailImageRefs({images: [], primaryImageAssetRef: undefined})).toEqual([]);
  });
});
