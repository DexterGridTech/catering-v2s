import {
  PrimitiveContainer,
  PrimitiveGrid,
  PrimitiveHeading,
  PrimitiveList,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import type {AdminSectionProps} from '../../types/adminSection'
import type {PlatformPortCapabilityState} from '@catering-v2s/kernel-base-platform-ports'

type CapabilityRow = Readonly<{
  readonly key: string
  readonly label: string
  readonly state: PlatformPortCapabilityState | 'missing'
  readonly source: string
  readonly tone: 'neutral' | 'ok' | 'warn'
}>

const tableRowStyle = Object.freeze({flexWrap: 'nowrap' as const, alignItems: 'center' as const})
const capabilityStyle = Object.freeze({flex: 2, minWidth: 0, fontSize: 12, lineHeight: 16})
const stateStyle = Object.freeze({flex: 1, minWidth: 0, fontSize: 12, lineHeight: 16})
const sourceStyle = Object.freeze({flex: 1, minWidth: 0, fontSize: 12, lineHeight: 16})

const stateLabelOf = (state: CapabilityRow['state']): string => {
  if (state === 'real') return '可用'
  if (state === 'unavailable') return '不可用'
  return '未提供'
}

const rowsOf = (context: AdminSectionProps['context']): readonly CapabilityRow[] => context.runtimeFacts.platformPortCapabilities.flatMap(snapshot => {
  if (snapshot.descriptorStatus === 'missing-descriptor' || snapshot.capabilities.length === 0) {
    return [{
      key: `${snapshot.port}:descriptor`,
      label: snapshot.port,
      state: 'missing',
      source: '—',
      tone: 'warn',
    }]
  }
  return snapshot.capabilities.map((capability): CapabilityRow => ({
    key: `${snapshot.port}:${capability.capability}`,
    label: `${snapshot.port}.${capability.capability}`,
    state: capability.state,
    source: capability.source,
    tone: capability.state === 'real' ? 'ok' : 'warn',
  }))
})

export const PlatformPortsSection = ({context}: AdminSectionProps) => (
  <PrimitiveContainer testID="admin.console.platform-ports" layout="content" bounded>
    <PrimitiveHeading testID="admin.console.platform-ports:title">{context.catalogEntry.title}</PrimitiveHeading>
    <PrimitiveGrid testID="admin.console.platform-ports:columns" style={tableRowStyle}>
      <PrimitiveText testID="admin.console.platform-ports:columns:capability" style={capabilityStyle}>能力</PrimitiveText>
      <PrimitiveText testID="admin.console.platform-ports:columns:state" style={stateStyle}>状态</PrimitiveText>
      <PrimitiveText testID="admin.console.platform-ports:columns:source" style={sourceStyle}>来源</PrimitiveText>
    </PrimitiveGrid>
    <PrimitiveList
      testID="admin.console.platform-ports:rows"
      accessibilityLabel="平台端口能力"
      data={rowsOf(context)}
      rowHeight={56}
      getItemKey={row => row.key}
      renderItem={row => (
        <PrimitiveGrid
          testID={`admin.console.platform-ports:row:${row.key}`}
          style={tableRowStyle}
        >
          <PrimitiveText testID={`admin.console.platform-ports:row:${row.key}:capability`} style={capabilityStyle}>
            {row.label}
          </PrimitiveText>
          <PrimitiveStatus testID={`admin.console.platform-ports:row:${row.key}:state`} style={stateStyle} tone={row.tone}>
            {stateLabelOf(row.state)}
          </PrimitiveStatus>
          <PrimitiveText testID={`admin.console.platform-ports:row:${row.key}:source`} style={sourceStyle}>
            {row.source}
          </PrimitiveText>
        </PrimitiveGrid>
      )}
    />
  </PrimitiveContainer>
)
