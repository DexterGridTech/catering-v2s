import {PrimitiveCard, PrimitiveContainer, PrimitiveEmptyState, PrimitiveFactGrid, PrimitiveHeading, PrimitiveScrollView, PrimitiveStack, PrimitiveStatusLine, PrimitiveSurfaceMap, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import type {AdminSectionProps} from '../../types/adminSection'
import {adminTestIds} from '../../foundations/adminTestIds'
import {useAdminRuntimeDisplay} from '../../hooks/useAdminRuntimeDisplay'

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})
const runtimeScrollPaddingBottom = 48

export const RuntimeSectionLaptop = ({context}: AdminSectionProps) => {
  const {facts, status, display, displayCountLabel, overallMessage} = useAdminRuntimeDisplay({context, surfaceForm: 'laptop'})

  return (
    <PrimitiveContainer testID={adminTestIds.runtime.section} layout="content" appearance="admin-content" bounded style={sectionStyle}>
      <PrimitiveScrollView testID="admin.console.runtime:scroll" contentPaddingBottom={runtimeScrollPaddingBottom}>
        <PrimitiveHeading appearance="admin-page" testID={adminTestIds.runtime.title}>{context.catalogEntry.title}</PrimitiveHeading>
        <PrimitiveCard appearance="admin" testID="admin.console.runtime:summary-card">
          <PrimitiveStatusLine testID={adminTestIds.runtime.overallStatus} tone={status === 'started' ? 'ok' : status === 'created' ? 'warn' : 'error'}>
            {overallMessage}
          </PrimitiveStatusLine>
          <PrimitiveFactGrid
            testID="admin.console.runtime:facts"
            columns={3}
            items={[
              {key: 'stage', label: '运行阶段', value: status === 'started' ? '正常' : status === 'created' ? '正在准备' : '不可用', tone: status === 'started' ? 'ok' as const : 'warn' as const},
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
            <PrimitiveStack testID="admin.console.runtime:surface-card">
              <PrimitiveSurfaceMap
                testID={adminTestIds.runtime.surfaceMap}
                accessibilityLabel="显示屏状态"
                direction="row"
                surfaces={display.surfaces}
              />
            </PrimitiveStack>
            <PrimitiveText appearance="admin-muted" testID={adminTestIds.runtime.legend}>逻辑分辨率为应用配置的画布尺寸；矩形按各屏设备比例绘制，物理分辨率分别读取</PrimitiveText>
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
