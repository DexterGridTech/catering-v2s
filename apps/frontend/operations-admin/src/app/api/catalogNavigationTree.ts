import type {CatalogNavigationView} from './generated/catalog-inventory-edge';

export type CatalogNavigationCategory = Pick<
  CatalogNavigationView['data']['tree'][number],
  'categoryRef' | 'code' | 'name' | 'parentCategoryRef' | 'displayOrder'
>;

export type CatalogNavigationCategoryTreeNode<T extends CatalogNavigationCategory = CatalogNavigationCategory> = {
  category: T;
  children: CatalogNavigationCategoryTreeNode<T>[];
};

/**
 * Builds the complete category hierarchy returned by the catalog navigation owner.
 * Orphaned categories remain visible as roots and malformed cycles are cut off without
 * dropping the rest of the owner response.
 */
export function buildCatalogNavigationCategoryTree<T extends CatalogNavigationCategory>(
  categories: readonly T[],
): CatalogNavigationCategoryTreeNode<T>[] {
  const byParent = new Map<string, T[]>();
  const byRef = new Map(categories.map(category => [String(category.categoryRef), category]));
  categories.forEach(category => {
    const parentRef = category.parentCategoryRef ? String(category.parentCategoryRef) : '';
    byParent.set(parentRef, [...(byParent.get(parentRef) ?? []), category]);
  });
  const sortCategories = (items: readonly T[]) =>
    items.slice().sort((left, right) => left.displayOrder - right.displayOrder || left.code.localeCompare(right.code));
  const rendered = new Set<string>();
  const buildNode = (category: T, ancestors: ReadonlySet<string>): CatalogNavigationCategoryTreeNode<T> | undefined => {
    const key = String(category.categoryRef);
    if (ancestors.has(key) || rendered.has(key)) return undefined;
    rendered.add(key);
    const children = sortCategories(byParent.get(key) ?? [])
      .map(child => buildNode(child, new Set(ancestors).add(key)))
      .filter((child): child is CatalogNavigationCategoryTreeNode<T> => Boolean(child));
    return {category, children};
  };

  const roots = sortCategories(
    categories.filter(category => {
      const parentRef = category.parentCategoryRef ? String(category.parentCategoryRef) : '';
      return !parentRef || !byRef.has(parentRef);
    }),
  )
    .map(category => buildNode(category, new Set()))
    .filter((category): category is CatalogNavigationCategoryTreeNode<T> => Boolean(category));

  // A malformed response may contain a component made entirely of a parent cycle,
  // so it has no natural root. Keep its first deterministic member visible and cut
  // only the back-edge; never silently drop an owner-returned category.
  for (const category of sortCategories(categories)) {
    const node = buildNode(category, new Set());
    if (node) roots.push(node);
  }
  return roots.sort(
    (left, right) =>
      left.category.displayOrder - right.category.displayOrder || left.category.code.localeCompare(right.category.code),
  );
}
