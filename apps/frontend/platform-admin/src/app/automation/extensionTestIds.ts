export const extensionTestIds = {
  categorySelector: 'extension-category-selector',
  definitionAuditHistory: 'extension-definition-audit-history',
  definitionEdit: 'extension-definition-edit',
  definitionRetry: 'extension-definition-retry',
  definitionTable: 'extension-definition-table',
  addField: 'extension-definition-add',
  cancel: 'extension-definition-cancel',
  save: 'extension-definition-save',
  error: 'extension-definition-error',
  saveResult: 'extension-definition-save-result',
  saveConfirm: 'extension-definition-save-confirm',
  conflictCancel: 'extension-definition-conflict-cancel',
  viewLatest: 'extension-definition-view-latest',
} as const;

export type ExtensionDefinitionFieldControl =
  'remove' | 'label' | 'type-display' | 'type' | 'list-display' | 'searchable' | 'required' | 'status' | 'option-add';

export type ExtensionDefinitionOptionControl = 'value' | 'remove';

/** Existing fields use their domain key; unsaved fields use Form.List's stable key. */
export function extensionDefinitionFieldIdentity(existingKey: string | undefined, draftId: string | number): string {
  return existingKey?.trim() || `draft-${draftId}`;
}

export function extensionDefinitionFieldTestId(
  entityType: string,
  fieldIdentity: string,
  control: ExtensionDefinitionFieldControl,
): string {
  return `extension-definition-${entityType.toLowerCase()}-${fieldIdentity}-${control}`;
}

export function extensionDefinitionOptionTestId(
  entityType: string,
  fieldIdentity: string,
  optionIdentity: string | number,
  control: ExtensionDefinitionOptionControl,
): string {
  return `extension-definition-${entityType.toLowerCase()}-${fieldIdentity}-option-${optionIdentity}-${control}`;
}
