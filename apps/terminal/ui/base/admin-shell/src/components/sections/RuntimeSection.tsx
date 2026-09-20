import {PrimitiveCard, PrimitiveContainer, PrimitiveEmptyState, PrimitiveFactGrid, PrimitiveHeading, PrimitiveScrollView, PrimitiveStack, PrimitiveStatusLine, PrimitiveSurfaceMap, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import {useRenderStatus} from '@catering-v2s/ui-base-render'
import type {AdminSectionProps} from '../../types/adminSection'
import {runtimeFrameId, useReportAdminFrame} from '../../foundations/adminFrameRegistry'
import {projectRuntimeDisplay} from '../../foundations/runtimeDisplay'
import {adminTestIds} from '../../foundations/adminTestIds'

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})
const runtimeScrollPaddingBottom = 48
const renderStatusLabel = (status: ReturnType<typeof useRenderStatus>): string => status === 'started' ? '正常' : status === 'created' ? '正在准备' : '不可用'

export const RuntimeSection = ({context}: AdminSectionProps) => {
  const facts = context.runtimeFacts
  const status = useRenderStatus()
  const display = projectRuntimeDisplay({
    facts: facts.displayFacts,
    surfaceForm: context.surface.surfaceForm,
    renderDisplayMode: context.surface.displayMode,
    currentLogicalSize: context.surface.hostLogicalSize,
  })
  const frameId = runtimeFrameId(context.surface.surfaceForm, facts.displayFacts)
  useReportAdminFrame(frameId)
  const physicalDisplayCount = facts.displayFacts?.physicalDisplayCount
  const displayCountLabel = physicalDisplayCount === null || physicalDisplayCount === undefined ? '未知' : String(physicalDisplayCount)
  const overallMessage = status === 'started'
    ? displayCountLabel === '2' ? '运行正常 · 检测到两块物理屏' : '运行正常 · 检测到一块物理屏'
    : `运行状态：${renderStatusLabel(status)}`
  return (
    <PrimitiveContainer testID={adminTestIds.runtime.section} layout="content" appearance="admin-content" bounded style={sectionStyle}>
        <PrimitiveScrollView testID="admin.console.runtime:scroll" contentPaddingBottom={runtimeScrollPaddingBottom}>
          <PrimitiveHeading appearance="admin-page" testID={adminTestIds.runtime.title}>{context.catalogEntry.title}</PrimitiveHeading>
          <PrimitiveCard appearance="admin" testID="admin.console.runtime:summary-card">
        <PrimitiveStatusLine
          testID={adminTestIds.runtime.overallStatus}
          tone={status === 'started' ? 'ok' : status === 'created' ? 'warn' : 'error'}
        >
          {overallMessage}
        </PrimitiveStatusLine>
        <PrimitiveFactGrid
          testID="admin.console.runtime:facts"
          items={[
            {key: 'stage', label: '运行阶段', value: renderStatusLabel(status), tone: status === 'started' ? 'ok' as const : 'warn' as const},
            {key: 'environment', testID: 'admin.console.runtime:environment', label: '环境', value: facts.environmentMode},
            {key: 'debug', testID: 'admin.console.runtime:debug', label: '调试态', value: `${facts.debugMode.enabled ? '开启' : '关闭'} / ${facts.debugMode.source}`, tone: facts.debugMode.enabled ? 'ok' as const : 'neutral' as const},
            {key: 'device', testID: 'admin.console.runtime:device', label: '设备', value: facts.deviceIdentity.available ? '可用' : '不可用', tone: facts.deviceIdentity.available ? 'ok' as const : 'warn' as const},
            {key: 'display-status', testID: 'admin.console.runtime:display-status', label: '显示事实', value: display.status === 'ready' ? '已读取' : display.reason ?? '显示事实不可用', tone: display.status === 'ready' ? 'ok' as const : 'warn' as const},
            {key: 'physical-display-count', testID: adminTestIds.runtime.physicalDisplayCount, label: '物理屏数量', value: displayCountLabel},
          ]}
        />
          </PrimitiveCard>
          {display.status === 'ready' ? (
          <>
            {context.surface.surfaceForm === 'mobile' ? <PrimitiveText appearance="admin-muted" testID={adminTestIds.runtime.mobileSingleSurfaceBoundary}>mobile 形态仅显示一块实际屏幕</PrimitiveText> : null}
            <PrimitiveStack testID="admin.console.runtime:surface-card">
              <PrimitiveSurfaceMap
                testID={adminTestIds.runtime.surfaceMap}
                accessibilityLabel="显示屏状态"
                direction={context.surface.surfaceForm === 'laptop' ? 'row' : 'column'}
                surfaces={display.surfaces}
                compact={context.surface.surfaceForm === 'mobile'}
              />
              <PrimitiveText appearance="admin-muted" testID={adminTestIds.runtime.legend}>当前屏幕显示完整事实；非当前屏幕仅显示存在性、角色与信息未提供边界</PrimitiveText>
            </PrimitiveStack>
          </>
          ) : (
            <PrimitiveEmptyState testID={adminTestIds.runtime.displayFactsError} tone="warn">
              {display.reason ?? '显示事实不可用'}
            </PrimitiveEmptyState>
          )}
      </PrimitiveScrollView>
    </PrimitiveContainer>
  )
}
