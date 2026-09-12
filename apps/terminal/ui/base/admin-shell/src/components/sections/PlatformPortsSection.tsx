import {
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveList,
  PrimitiveStatusRow,
} from '@catering-v2s/ui-base-primitives'
import type {AdminSectionProps} from '../../types/adminSection'

type CapabilityRow = Readonly<{
  readonly key: string
  readonly label: string
  readonly value: string
  readonly tone: 'neutral' | 'ok' | 'warn'
}>

const rowsOf = (context: AdminSectionProps['context']): readonly CapabilityRow[] => context.runtimeFacts.platformPortCapabilities.flatMap(snapshot => {
  if (snapshot.descriptorStatus === 'missing-descriptor' || snapshot.capabilities.length === 0) {
    return [{
      key: `${snapshot.port}:descriptor`,
      label: snapshot.port,
      value: '不可用 / 缺少能力描述',
      tone: 'warn',
    }]
  }
  return snapshot.capabilities.map(capability => ({
    key: `${snapshot.port}:${capability.capability}`,
    label: `${snapshot.port}.${capability.capability}`,
    value: `${capability.state} / ${capability.source}`,
    tone: capability.state === 'real' ? 'ok' : 'warn',
  }))
})

export const PlatformPortsSection = ({context}: AdminSectionProps) => (
  <PrimitiveContainer testID="admin.console.platform-ports" layout="content">
    <PrimitiveHeading testID="admin.console.platform-ports:title">{context.catalogEntry.title}</PrimitiveHeading>
    <PrimitiveList
      testID="admin.console.platform-ports:rows"
      accessibilityLabel="平台端口能力"
      data={rowsOf(context)}
      rowHeight={56}
      getItemKey={row => row.key}
      renderItem={row => (
        <PrimitiveStatusRow
          testID={`admin.console.platform-ports:row:${row.key}`}
          label={row.label}
          value={row.value}
          tone={row.tone}
        />
      )}
    />
  </PrimitiveContainer>
)
