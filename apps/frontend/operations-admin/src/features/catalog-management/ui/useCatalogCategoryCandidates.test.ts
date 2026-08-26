import {describe, expect, it} from 'vitest';
import {withSelectedCategoryPath, type CatalogCategorySelectorNode} from './useCatalogCategoryCandidates';

describe('withSelectedCategoryPath', () => {
  it('shows the owner-backed selected path rather than a UUID when its ancestor page is not loaded', () => {
    const tree = withSelectedCategoryPath([], {
      categoryRef: '416609e5-2ffc-4ad8-bce7-523af24ed52',
      pathLabels: ['餐饮', '饮品', '咖啡'],
    });

    expect(tree).toEqual([
      expect.objectContaining({
        value: '416609e5-2ffc-4ad8-bce7-523af24ed52',
        title: '餐饮 / 饮品 / 咖啡',
      }),
    ]);
    expect(String(tree[0]?.title)).not.toContain('416609e5');
  });

  it('does not add a duplicate selected node when the tree already contains it below a parent', () => {
    const base: CatalogCategorySelectorNode[] = [
      {value: 'food', key: 'food', title: '餐饮', children: [{value: 'coffee', key: 'coffee', title: '咖啡'}]},
    ];

    expect(withSelectedCategoryPath(base, {categoryRef: 'coffee', pathLabels: ['餐饮', '咖啡']})).toEqual(base);
  });
});
