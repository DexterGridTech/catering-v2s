import {PrimitiveContainer, PrimitiveHeading, PrimitiveKeyValueRow, PrimitiveScrollView, PrimitiveStatusRow} from '@catering-v2s/ui-base-primitives'
import type {AdminSectionProps} from '../../types/adminSection'

export const RuntimeSection = ({context}: AdminSectionProps) => {
  const facts = context.runtimeFacts
  const status = context.stateSource.getStatus()
  return (
    <PrimitiveContainer testID="admin.console.runtime" layout="content" bounded>
      <PrimitiveScrollView testID="admin.console.runtime:scroll">
        <PrimitiveHeading testID="admin.console.runtime:title">{context.catalogEntry.title}</PrimitiveHeading>
        <PrimitiveKeyValueRow testID="admin.console.runtime:status" label="运行状态" value={status} />
        <PrimitiveKeyValueRow testID="admin.console.runtime:environment" label="环境" value={facts.environmentMode} />
        <PrimitiveStatusRow
          testID="admin.console.runtime:debug"
          label="调试态"
          value={`${facts.debugMode.enabled ? '开启' : '关闭'} / ${facts.debugMode.source}`}
          tone={facts.debugMode.enabled ? 'ok' : 'neutral'}
        />
        <PrimitiveKeyValueRow
          testID="admin.console.runtime:device"
          label="设备标识"
          value={facts.deviceIdentity.available ? '可用' : '不可用'}
        />
      </PrimitiveScrollView>
    </PrimitiveContainer>
  )
}
