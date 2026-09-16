import {PrimitiveGrid, PrimitivePressOption} from '@catering-v2s/ui-base-primitives'
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
}>) => (
  <PrimitiveGrid testID="terminal.admin:navigation" accessibilityLabel="终端管理分区" style={{flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch'}}>
    {sections.map(section => (
      <PrimitivePressOption
        key={section.partKey}
        testID={adminTestIds.section(section.partKey)}
        accessibilityLabel={`选择${section.title}`}
        accessibilityRole="button"
        selected={selectedPartKey === section.partKey}
        variant="option"
        onPress={() => onSelect(section.partKey)}
      >
        {section.title}
      </PrimitivePressOption>
    ))}
  </PrimitiveGrid>
)
