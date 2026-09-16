import {PrimitiveGrid, PrimitivePressOption} from '@catering-v2s/ui-base-primitives'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {adminTestIds} from '../foundations/adminTestIds'

export const AdminSectionNavigation = ({
  sections,
  selectedPartKey,
  onSelect,
}: Readonly<{
  readonly sections: readonly UiCatalogEntry[]
  readonly selectedPartKey: string | null
  readonly onSelect: (partKey: string) => void
}>) => (
  <PrimitiveGrid
    testID="terminal.admin:navigation"
    accessibilityRole="tablist"
    accessibilityLabel="终端管理分区"
    style={{flexWrap: 'wrap'}}
  >
    {sections.map(section => (
      <PrimitivePressOption
        key={section.partKey}
        testID={adminTestIds.section(section.partKey)}
        accessibilityLabel={`选择${section.title}`}
        accessibilityRole="tab"
        selected={selectedPartKey === section.partKey}
        variant="tab"
        onPress={() => onSelect(section.partKey)}
      >
        {section.title}
      </PrimitivePressOption>
    ))}
  </PrimitiveGrid>
)
