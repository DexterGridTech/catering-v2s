import type {TagProps} from 'antd';

export const LIFECYCLE_LABELS = {
  ENABLED: '启用',
  DISABLED: '停用',
  VOIDED: '作废',
} as const;

export type LifecycleStatus = keyof typeof LIFECYCLE_LABELS;

export const LIFECYCLE_COLORS: Readonly<Record<LifecycleStatus, TagProps['color']>> = {
  ENABLED: 'success',
  DISABLED: 'warning',
  VOIDED: 'error',
};

export function lifecycleLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return status in LIFECYCLE_LABELS ? LIFECYCLE_LABELS[status as LifecycleStatus] : status;
}

export function lifecycleColor(status: string): TagProps['color'] {
  return status in LIFECYCLE_COLORS ? LIFECYCLE_COLORS[status as LifecycleStatus] : 'default';
}
