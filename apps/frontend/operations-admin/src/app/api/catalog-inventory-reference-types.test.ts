import {describe, expect, it} from 'vitest';
import type {CatalogCategoryCreateRequest, FaceOperationContracts, Uuid} from './generated/catalog-inventory-edge';

const knownUuid = '00000000-0000-4000-8000-000000000001' as Uuid;
const businessCode = 'CATEGORY-ROOT';

// These are intentional negative compile fixtures. If the generated Ref type
// regresses to string, TypeScript reports TS2578 because the directives become
// unused; if the directives are removed, the fixture itself must fail to typecheck.
// @ts-expect-error BUSINESS_CODE_MUST_NOT_ENTER_UUID
const businessCodeAsUuid: Uuid = businessCode;

const businessCodeAsCategoryRef: CatalogCategoryCreateRequest = {
  dataNodeRef: knownUuid,
  code: 'CATEGORY-CHILD',
  name: 'Child',
  // @ts-expect-error BUSINESS_CODE_MUST_NOT_ENTER_REF
  parentCategoryRef: businessCode,
};

const businessCodeAsPathRef: FaceOperationContracts['getOperationsInventoryTarget']['path'] = {
  // @ts-expect-error BUSINESS_CODE_MUST_NOT_ENTER_PATH_REF
  targetRef: businessCode,
};

const nullableCategoryRef: CatalogCategoryCreateRequest = {
  dataNodeRef: knownUuid,
  code: 'CATEGORY-ROOT',
  name: 'Root',
  parentCategoryRef: null,
};

describe('generated UUID reference contracts', () => {
  it('keeps nullable Ref fields nullable while rejecting business codes', () => {
    expect(nullableCategoryRef.parentCategoryRef).toBeNull();
    expect(businessCodeAsCategoryRef.parentCategoryRef).toBe('CATEGORY-ROOT');
    expect(businessCodeAsPathRef.targetRef).toBe('CATEGORY-ROOT');
    expect(businessCodeAsUuid).toBe('CATEGORY-ROOT');
  });
});
