import type {ReactNode} from 'react'
import type {RuntimeStatus} from '@catering-v2s/kernel-base-runtime'
import {adminGeometry, PrimitiveBadge, PrimitiveButton, PrimitiveContainer, PrimitiveEmptyState, PrimitiveGrid, PrimitiveHeading, PrimitiveIconBadge, PrimitiveInlineAlert, PrimitiveSkeleton, PrimitiveSpinner} from '@catering-v2s/ui-base-primitives'
import {useSurfaceContext} from '@catering-v2s/ui-base-render'
import {adminFrameTestId, panelFrameId} from '../foundations/adminFrameRegistry'
import {adminTestIds} from '../foundations/adminTestIds'
import type {AdminPanelStatus, AdminShellProps} from '../types/adminShell'
import type {AdminFrameId} from '../foundations/adminFrameRegistry'

export type AdminShellFrameProps = AdminShellProps & Readonly<{
  readonly status: AdminPanelStatus
  readonly frameId?: AdminFrameId
  readonly children: ReactNode
}>

export const adminPanelStatusFromRuntime = (runtimeStatus: RuntimeStatus): AdminPanelStatus => {
  if (runtimeStatus === 'started') return {tone: 'ok', label: '正常'}
  if (runtimeStatus === 'failed') return {tone: 'error', label: '不可用'}
  if (runtimeStatus === 'starting') return {tone: 'warn', label: '正在加载'}
  return {tone: 'warn', label: '正在准备'}
}

/** Shared full-canvas frame; form-specific components own their internal layout. */
export const AdminShellFrame = ({onClose, status, frameId, children}: AdminShellFrameProps) => {
  const surface = useSurfaceContext()
  const mobile = surface.surfaceForm === 'mobile'
  const normalFrameId = frameId ?? panelFrameId(surface.surfaceForm, 'normal')
  const rootStyle = mobile
    ? {flex: 1, width: '100%' as const, minWidth: 0, alignItems: 'center' as const, justifyContent: 'center' as const, ...adminGeometry.rootMobile}
    : {flex: 1, width: '100%' as const, minWidth: 0, alignItems: 'center' as const, justifyContent: 'center' as const, ...adminGeometry.rootLaptop}
  // Keep the shell inside the surface while each page owns its own scroll.
  // Without this cap, a topology page can grow the card beyond the viewport;
  // centering then places the fixed header/close control above the visible
  // surface instead of letting the content area scroll.
  const panelStyle = mobile
    ? {...adminGeometry.shellMobile, maxHeight: '100%' as const, overflow: 'hidden' as const}
    : {...adminGeometry.shellLaptop, maxHeight: '100%' as const, overflow: 'hidden' as const}
  const headerStyle = mobile ? adminGeometry.headerMobile : adminGeometry.headerLaptop
  return (
    <PrimitiveContainer testID={adminTestIds.shell} layout="fill" appearance="admin-root" style={rootStyle}>
      <PrimitiveContainer
        testID={adminFrameTestId(normalFrameId)}
        layout="card"
        appearance={mobile ? 'admin-shell-mobile' : 'admin-shell'}
        style={panelStyle}
      >
        <PrimitiveContainer testID={adminTestIds.panel.frame} layout="transparent" appearance="admin-content" style={{flex: 1, minHeight: 0, minWidth: 0}}>
          <PrimitiveGrid testID={adminTestIds.panel.header} appearance="admin-header" style={headerStyle}>
            <PrimitiveIconBadge testID={adminTestIds.panel.brand} accessibilityLabel="终端管理" icon="admin" />
            <PrimitiveHeading appearance="admin-shell" testID="terminal.admin:shell:title">终端管理</PrimitiveHeading>
            <PrimitiveBadge appearance="admin-status" testID={adminTestIds.panel.status} tone={status.tone}>{status.label}</PrimitiveBadge>
            <PrimitiveButton
              testID={adminTestIds.close}
              accessibilityLabel="关闭终端管理"
              appearance="admin-icon"
              icon="close"
              onPress={onClose}
              style={{marginLeft: 'auto'}}
            >
              关闭
            </PrimitiveButton>
          </PrimitiveGrid>
          <PrimitiveContainer testID={adminTestIds.panel.body} layout="transparent" appearance="admin-content" style={mobile ? {flex: 1, minHeight: 0, minWidth: 0, gap: 12} : {flex: 1, minHeight: 0, minWidth: 0}}>
            {children}
          </PrimitiveContainer>
        </PrimitiveContainer>
      </PrimitiveContainer>
    </PrimitiveContainer>
  )
}

export const AdminPanelStateCard = ({
  state,
  onRetry,
}: Readonly<{
  readonly state: 'empty' | 'loading' | 'error'
  readonly onRetry?: () => void | Promise<void>
}>) => {
  if (state === 'empty') {
    return (
      <PrimitiveContainer testID={adminTestIds.panel.empty} layout="transparent" appearance="admin-content" style={{flex: 1}}>
        <PrimitiveEmptyState testID={`${adminTestIds.panel.empty}:reason`} accessibilityLabel="暂无可显示内容">
          暂无可显示内容；请先完成运行时准备
        </PrimitiveEmptyState>
      </PrimitiveContainer>
    )
  }
  if (state === 'loading') {
    return (
      <PrimitiveContainer testID={adminTestIds.panel.loading} layout="card" appearance="admin-card">
        <PrimitiveContainer testID={`${adminTestIds.panel.loading}:content`} layout="transparent" appearance="admin-content">
          <PrimitiveSpinner testID={`${adminTestIds.panel.loading}:spinner`} accessibilityLabel="正在加载终端管理" />
          <PrimitiveSkeleton testID={`${adminTestIds.panel.loading}:skeleton`} accessibilityLabel="终端管理内容加载中" />
          <PrimitiveEmptyState testID={`${adminTestIds.panel.loading}:message`}>正在加载终端管理</PrimitiveEmptyState>
        </PrimitiveContainer>
      </PrimitiveContainer>
    )
  }
  return (
    <PrimitiveContainer testID={adminTestIds.panel.error} layout="card" appearance="admin-card">
        <PrimitiveContainer testID={`${adminTestIds.panel.error}:content`} layout="transparent" appearance="admin-content">
          <PrimitiveInlineAlert testID={`${adminTestIds.panel.error}:reason`} accessibilityLabel="终端管理加载失败">
            终端管理暂不可用，请重试
          </PrimitiveInlineAlert>
          <PrimitiveButton
            appearance="admin-primary"
            testID={adminTestIds.panel.retry}
            accessibilityLabel="重试终端管理"
            disabled={onRetry === undefined}
            onPress={() => { void onRetry?.() }}
          >
            重试
          </PrimitiveButton>
        </PrimitiveContainer>
    </PrimitiveContainer>
  )
}
