/** Stable locators for terminal update package management. */
export const terminalUpdateTestIds = {
  page: 'platform-terminal-update-page',
  upload: 'platform-terminal-update-upload',
  uploadInput: 'platform-terminal-update-upload-input',
  artifactKind: 'platform-terminal-update-artifact-kind',
  artifactKindOption: (kind: 'FULL' | 'HOT') => `platform-terminal-update-artifact-kind-option-${kind.toLowerCase()}`,
  artifactFilterKind: 'platform-terminal-update-artifact-filter-kind',
  minimumFull: 'platform-terminal-update-minimum-full',
  minimumFullCandidate: (artifactRef: string) => `platform-terminal-update-minimum-full-candidate-${artifactRef}`,
  save: 'platform-terminal-update-save',
  list: 'platform-terminal-update-list',
  detail: 'platform-terminal-update-detail',
  parseSuccess: 'platform-terminal-update-parse-success',
  refresh: 'platform-terminal-update-refresh',
  releaseStagedUpload: 'platform-terminal-update-release-staged-upload',
} as const;
