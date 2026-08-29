import {describe, expect, it} from 'vitest';
import {catalogCategoryCanCreateChild, catalogCategoryDepthLimitCopy} from './CatalogWorkbenchNavigationTree';
import type {CatalogNavigation} from '../model/catalogModel';

type Category = CatalogNavigation['tree'][number];

const category = (categoryRef: string, parentCategoryRef: string | null): Category =>
  ({
    categoryRef,
    code: categoryRef.toUpperCase(),
    name: categoryRef,
    parentCategoryRef,
    version: 1,
    displayOrder: 0,
    count: 0,
    countSemantics: 'SELF_ONLY',
    deletionAvailability: {
      canDelete: true,
      subtreeSize: 1,
      blockingReferenceCount: 0,
      blockingReferences: {count: 0, references: []},
    },
  }) as unknown as Category;

describe('catalog category child entry availability', () => {
  it('uses the same business-facing three-level limit wording as the owner problem', () => {
    expect(catalogCategoryDepthLimitCopy).toBe('商品分类最多只能建立三级');
  });

  it('allows child creation below root and second-level categories but disables it at level three', () => {
    const root = category('root', null);
    const second = category('second', root.categoryRef);
    const third = category('third', second.categoryRef);
    const categories = [root, second, third];

    expect(catalogCategoryCanCreateChild(root, categories)).toBe(true);
    expect(catalogCategoryCanCreateChild(second, categories)).toBe(true);
    expect(catalogCategoryCanCreateChild(third, categories)).toBe(false);
  });

  it('fails closed for a malformed or cyclic navigation path instead of exposing an impossible child task', () => {
    const orphan = category('orphan', 'missing');
    const left = category('left', 'right');
    const right = category('right', 'left');

    expect(catalogCategoryCanCreateChild(orphan, [orphan])).toBe(false);
    expect(catalogCategoryCanCreateChild(left, [left, right])).toBe(false);
  });
});
