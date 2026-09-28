import {adminGeometry, PrimitiveGrid, PrimitivePressOption} from '@catering-v2s/ui-base-primitives'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {adminTestIds} from '../foundations/adminTestIds'

export const AdminSectionNavigationLaptop = ({
  sections,
  selectedPartKey,
  onSelect,
}: Readonly<{
  readonly sections: readonly UiCatalogEntry[]
  readonly selectedPartKey: string | null
  readonly onSelect: (partKey: string) => void
}>) => {
  const items = sections.map(section => (
      <PrimitivePressOption
        key={section.partKey}
        testID={adminTestIds.section(section.partKey)}
        accessibilityLabel={`选择${section.title}`}
        accessibilityRole="button"
        selected={selectedPartKey === section.partKey}
        variant="admin-nav"
        icon={section.partKey === 'admin.console.platform-ports' ? 'server' : section.partKey === 'admin.console.runtime' ? 'monitor' : 'link'}
        onPress={() => onSelect(section.partKey)}
      >
        {section.title}
      </PrimitivePressOption>
  ))
  return (
    <PrimitiveGrid testID="terminal.admin:navigation" appearance="admin-nav" accessibilityLabel="终端管理分区" style={adminGeometry.navigationList}>
      {items}
    </PrimitiveGrid>
  )
}
