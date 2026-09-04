/** Stable test-id vocabulary for the shared operations workspace scope surface. */
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
const dataScopeOptionPrefixes = {
  HEAD_COMPANY: 'operations-data-scope-option-head_company-',
  REGION: 'operations-data-scope-option-region-',
  PROJECT: 'operations-data-scope-option-project-',
  STORE: 'operations-data-scope-option-store-',
} as const;

const dataScopeOptionTestId = (dataNodeType: string, dataNodeRef: string) => {
  const prefix = dataScopeOptionPrefixes[dataNodeType as keyof typeof dataScopeOptionPrefixes];
  return `${prefix ?? `operations-data-scope-option-${slug(dataNodeType)}-`}${slug(dataNodeRef)}`;
};

export const roleHomeTestIds = {
  dataScope: {
    trigger: 'operations-data-scope-trigger',
    headCompany: 'operations-data-scope-head-company',
    region: 'operations-data-scope-region',
    project: 'operations-data-scope-project',
    store: 'operations-data-scope-store',
    option: dataScopeOptionTestId,
    cancel: 'operations-data-scope-cancel',
    confirm: 'operations-data-scope-confirm',
  },
} as const;
