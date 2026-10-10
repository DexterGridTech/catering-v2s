export type TerminalUpdateRuleStatus = 'ENABLED' | 'DISABLED';

export const isTerminalUpdateVersionConflict = (problem: Readonly<{status: number; errorCode: string}>): boolean =>
  problem.status === 409 && problem.errorCode === 'PLATFORM_COMMON_VERSION_CONFLICT';

export const terminalUpdateStatusAlreadyApplied = (
  current: TerminalUpdateRuleStatus,
  intent: TerminalUpdateRuleStatus,
): boolean => current === intent;

export const terminalUpdateStatusActionLabel = (intent: TerminalUpdateRuleStatus): string =>
  intent === 'ENABLED' ? '启用' : '停用';

export const terminalUpdateStatusConfirmTitle = (intent: TerminalUpdateRuleStatus, target: string): string =>
  `${terminalUpdateStatusActionLabel(intent)}“${target}”？`;
