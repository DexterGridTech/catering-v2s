export const operationsNavigationTestIds = {
  page: (pageDesignKey: string) => `operations-navigation-page-${pageDesignKey.toLowerCase()}`,
} as const;

export const extensionFormTestIds = {
  field: (entity: 'store' | 'contract', key: string) =>
    `operations-${entity}-edit-extension-${key}`,
  submit: (entity: 'store' | 'contract') => `operations-${entity}-edit-submit`,
  cancel: (entity: 'store' | 'contract') => `operations-${entity}-edit-cancel`,
  dirtyCancel: (entity: 'store' | 'contract') => `operations-${entity}-edit-dirty-cancel`,
  dirtyConfirm: (entity: 'store' | 'contract') => `operations-${entity}-edit-dirty-confirm`,
} as const;
