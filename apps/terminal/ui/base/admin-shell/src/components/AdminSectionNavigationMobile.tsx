import {useState} from 'react'
import {PrimitiveDropdownSelect} from '@catering-v2s/ui-base-primitives'
import type {UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'

/** Mobile-only page navigation: one controlled dropdown and no horizontal tab row. */
export const AdminSectionNavigationMobile = ({
  sections,
  selectedPartKey,
  onSelect,
}: Readonly<{
  readonly sections: readonly UiCatalogEntry[]
  readonly selectedPartKey: string | null
  readonly onSelect: (partKey: string) => void
}>) => {
  const [open, setOpen] = useState(false)
  const options = sections.map(section => ({value: section.partKey, label: section.title}))
  const value = selectedPartKey ?? options[0]?.value ?? ''
  return (
    <PrimitiveDropdownSelect
      testID="terminal.admin:navigation"
      accessibilityLabel="选择终端管理页面"
      options={options}
      value={value}
      open={open}
      appearance="admin-mobile"
      disabled={options.length === 0}
      onOpenChange={setOpen}
      onValueChange={onSelect}
    />
  )
}
