import type {ReactNode} from 'react';
import type {RuntimeStatus} from '@catering-v2s/kernel-base-runtime';
import type {AdminPanelStatus, AdminShellProps} from '../types/adminShell';
import type {AdminFrameId} from '../foundations/adminFrameRegistry';

export type AdminShellFrameProps = AdminShellProps &
  Readonly<{
    readonly status: AdminPanelStatus;
    readonly frameId?: AdminFrameId;
    readonly children: ReactNode;
  }>;

export const adminPanelStatusFromRuntime = (runtimeStatus: RuntimeStatus): AdminPanelStatus => {
  if (runtimeStatus === 'started') return {tone: 'ok', label: '正常'};
  if (runtimeStatus === 'failed') return {tone: 'error', label: '不可用'};
  if (runtimeStatus === 'starting') return {tone: 'warn', label: '正在加载'};
  return {tone: 'warn', label: '正在准备'};
};
