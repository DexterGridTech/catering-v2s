/** Stable locators for selecting a platform group workspace. */
export const platformWorkspaceTestIds = {
  selector: 'platform-workspace-selector',
  option: (groupWorkspaceKey: string) => `platform-workspace-option-${groupWorkspaceKey}`,
} as const;
