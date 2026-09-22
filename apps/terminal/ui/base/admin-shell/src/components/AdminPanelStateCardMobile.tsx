import {PrimitiveButton, PrimitiveContainer, PrimitiveEmptyState, PrimitiveInlineAlert, PrimitiveSkeleton, PrimitiveSpinner} from '@catering-v2s/ui-base-primitives'
import {adminTestIds} from '../foundations/adminTestIds'

export const AdminPanelStateCardMobile = ({
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
      <PrimitiveContainer testID={adminTestIds.panel.loading} layout="card" appearance="admin-card" style={{minHeight: 160, width: '100%'}}>
        <PrimitiveContainer testID={`${adminTestIds.panel.loading}:content`} layout="transparent" appearance="admin-content" style={{width: '100%'}}>
          <PrimitiveSpinner testID={`${adminTestIds.panel.loading}:spinner`} accessibilityLabel="正在加载终端管理" />
          <PrimitiveSkeleton testID={`${adminTestIds.panel.loading}:skeleton`} accessibilityLabel="终端管理内容加载中" />
          <PrimitiveEmptyState testID={`${adminTestIds.panel.loading}:message`}>正在加载终端管理</PrimitiveEmptyState>
        </PrimitiveContainer>
      </PrimitiveContainer>
    )
  }
  return (
    <PrimitiveContainer testID={adminTestIds.panel.error} layout="card" appearance="admin-card" style={{minHeight: 160, width: '100%'}}>
      <PrimitiveContainer testID={`${adminTestIds.panel.error}:content`} layout="transparent" appearance="admin-content" style={{width: '100%'}}>
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
