import {LIFECYCLE_COLORS, LIFECYCLE_LABELS} from '@catering-v2s/admin-ui-foundation';

export function terminalUpdateRuleTablePresentation(status: string) {
  const lifecycleStatus = status === 'ENABLED' ? 'ENABLED' : 'DISABLED';
  return {
    label: LIFECYCLE_LABELS[lifecycleStatus],
    color: LIFECYCLE_COLORS[lifecycleStatus],
  };
}

export function terminalUpdateRuleDetailLabel(status: string): string {
  if (status === 'ENABLED' || status === 'DISABLED') return LIFECYCLE_LABELS[status];
  return '状态未知';
}

export function terminalUpdateRuleStoreLabel(status: string): string {
  if (status === 'ENABLED' || status === 'DISABLED') return LIFECYCLE_LABELS[status];
  if (status === 'VOIDED') return '已作废';
  if (status === 'UNKNOWN') return '未知';
  return LIFECYCLE_LABELS.ENABLED;
}
