import {PrimitivePressOption, PrimitiveStack} from '@catering-v2s/ui-base-primitives'
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
  <PrimitiveStack testID="terminal.admin:navigation">
    {sections.map(section => (
      <PrimitivePressOption
        key={section.partKey}
        testID={adminTestIds.section(section.partKey)}
        accessibilityLabel={`选择${section.title}`}
        selected={selectedPartKey === section.partKey}
        onPress={() => onSelect(section.partKey)}
      >
        {section.title}
      </PrimitivePressOption>
    ))}
  </PrimitiveStack>
)
