import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context'
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import {PrimitiveContainer, PrimitiveHeading, PrimitiveKeyValueRow, PrimitiveScrollView, PrimitiveStatusRow} from '@catering-v2s/ui-base-primitives'
import type {AdminSectionProps} from '../../types/adminSection'

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})

export const DisplayContextSection = ({context}: AdminSectionProps) => {
  const role = selectDisplayRole(context.stateRoot)
  const instanceMode = selectRuntimeInstanceMode(context.stateRoot)
  const hostReady = context.surface.surfaceIdentity !== null
  const hostSize = context.surface.hostLogicalSize
  return (
    <PrimitiveContainer testID="admin.console.display-context" layout="content" bounded style={sectionStyle}>
      <PrimitiveScrollView testID="admin.console.display-context:scroll">
        <PrimitiveHeading testID="admin.console.display-context:title">{context.catalogEntry.title}</PrimitiveHeading>
        <PrimitiveKeyValueRow testID="admin.console.display-context:form" label="形态" value={context.surface.surfaceForm} />
        <PrimitiveKeyValueRow testID="admin.console.display-context:mode" label="画布模式" value={context.surface.displayMode} />
        <PrimitiveKeyValueRow testID="admin.console.display-context:role" label="显示角色" value={role} />
        <PrimitiveKeyValueRow testID="admin.console.display-context:instance" label="实例模式" value={instanceMode} />
        <PrimitiveStatusRow
          testID="admin.console.display-context:host"
          label="主承载显示"
          value={context.surface.isHostPrimaryDisplay ? '是' : '否'}
          tone={context.surface.isHostPrimaryDisplay ? 'ok' : 'neutral'}
        />
        <PrimitiveKeyValueRow
          testID="admin.console.display-context:ready"
          label="承载状态"
          value={hostReady ? 'ready' : 'loading'}
        />
        <PrimitiveKeyValueRow
          testID="admin.console.display-context:geometry"
          label="承载几何"
          value={hostSize === null ? '未就绪' : `${hostSize.width}×${hostSize.height}`}
        />
      </PrimitiveScrollView>
    </PrimitiveContainer>
  )
}
