export function extensionListSearchTestId(listScope: string, fieldKey: string) {
  return `${listScope}-${fieldKey}`;
}

export function extensionListRecoveryNoticeTestId(listScope: string) {
  return `${listScope}-extension-recovery-notice`;
}

export function extensionListInvalidSummaryTestId(listScope: string) {
  return `${listScope}-extension-invalid-summary`;
}
