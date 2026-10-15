type OrderedPage = {menuOrder: number};

export function selectAccessibleOperationsPages<Key extends string, Page extends OrderedPage, Registration>(
  pageAccessKeys: readonly Key[],
  catalogByKey: ReadonlyMap<Key, Page>,
  pageRegistry: Partial<Record<Key, Registration>>,
): Array<{key: Key; page: Page; registration: Registration}> {
  return pageAccessKeys
    .flatMap(key => {
      const page = catalogByKey.get(key);
      const registration = pageRegistry[key];
      return page && registration ? [{key, page, registration}] : [];
    })
    .sort((left, right) => left.page.menuOrder - right.page.menuOrder);
}
