import {useMemo, useState} from 'react'
import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveEmptyState,
  PrimitiveGrid,
  PrimitiveHeading,
  PrimitiveKeyValueRow,
  PrimitiveStack,
} from '@catering-v2s/ui-base-primitives'
import {
  createCatalogContext,
  useRenderContext,
  useRenderSnapshot,
  useSurfaceContext,
} from '@catering-v2s/ui-base-render'
import {selectAdminSections, createAdminSectionCommandBoundary} from '../foundations/adminSectionSelection'
import {AdminSectionNavigation} from './AdminSectionNavigation'
import {adminTestIds} from '../foundations/adminTestIds'
import type {AdminSectionComponent} from '../types/adminSection'

export type AdminShellProps = Readonly<{
  readonly onClose: () => void
}>

export const AdminShell = ({onClose}: AdminShellProps) => {
  const {uiCatalog, rendererCatalog, stateSource, runtimeFacts, selectSurfaceForm} = useRenderContext()
  const surface = useSurfaceContext()
  const snapshot = useRenderSnapshot()
  const [selectedPartKey, setSelectedPartKey] = useState<string | null>(null)
  const commandBoundary = useMemo(() => createAdminSectionCommandBoundary(), [])

  if (snapshot.root === undefined) {
    return (
      <PrimitiveContainer testID={adminTestIds.shell} layout="card" bounded>
        <PrimitiveHeading testID="terminal.admin:shell:title">终端管理</PrimitiveHeading>
        <PrimitiveEmptyState testID={`${adminTestIds.content}:unavailable`}>运行状态尚未就绪</PrimitiveEmptyState>
        <PrimitiveButton testID={adminTestIds.close} onPress={onClose}>关闭</PrimitiveButton>
      </PrimitiveContainer>
    )
  }

  const catalogContext = createCatalogContext(snapshot.root, surface.displayMode, selectSurfaceForm(snapshot.root))
  const sections = selectAdminSections(uiCatalog, catalogContext)
  const activePartKey = sections.some(section => section.partKey === selectedPartKey)
    ? selectedPartKey
    : sections[0]?.partKey ?? null
  const activeEntry = activePartKey === null
    ? undefined
    : sections.find(section => section.partKey === activePartKey)
  const activeBinding = activeEntry === undefined
    ? undefined
    : rendererCatalog.resolve(activeEntry.rendererKey)
  const activeSection = activeBinding?.component as AdminSectionComponent | undefined

  return (
    <PrimitiveContainer testID={adminTestIds.shell} layout="card" bounded style={{flex: 1}}>
      <PrimitiveGrid testID="terminal.admin:header" style={{flexWrap: 'nowrap'}}>
        <PrimitiveStack testID="terminal.admin:header:facts" style={{flex: 1, minWidth: 0}}>
          <PrimitiveHeading testID="terminal.admin:shell:title">终端管理</PrimitiveHeading>
          <PrimitiveKeyValueRow testID="terminal.admin:shell:form" label="形态" value={surface.surfaceForm} />
          <PrimitiveKeyValueRow testID="terminal.admin:shell:mode" label="画布模式" value={surface.displayMode} />
          <PrimitiveKeyValueRow
            testID="terminal.admin:shell:host"
            label="主承载显示"
            value={surface.isHostPrimaryDisplay ? '是' : '否'}
          />
        </PrimitiveStack>
        <PrimitiveButton
          testID={adminTestIds.close}
          accessibilityLabel="关闭终端管理"
          onPress={onClose}
          style={{flexShrink: 0}}
        >
          关闭
        </PrimitiveButton>
      </PrimitiveGrid>
      <AdminSectionNavigation
        sections={sections}
        selectedPartKey={activePartKey}
        onSelect={setSelectedPartKey}
      />
      <PrimitiveContainer testID={adminTestIds.content} layout="content" bounded>
        {activeEntry === undefined || activeSection === undefined ? (
          <PrimitiveEmptyState testID={`${adminTestIds.content}:empty`} accessibilityLabel="暂无可用诊断节">
            暂无可用诊断节
          </PrimitiveEmptyState>
        ) : (() => {
          const ActiveSection = activeSection
          return (
            <ActiveSection
              context={{
                catalogEntry: activeEntry,
                stateRoot: snapshot.root,
                stateSource,
                runtimeFacts,
                surface,
                commandBoundary,
              }}
            />
          )
        })()}
      </PrimitiveContainer>
    </PrimitiveContainer>
  )
}
