import {useCallback, useMemo, useState} from 'react'
import type {UiCatalog, UiCatalogContext, UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {selectAdminSections} from '../foundations/adminSectionSelection'

export type UseAdminSectionsInput = Readonly<{
  readonly catalog: UiCatalog
  readonly context: UiCatalogContext
}>

export type AdminSectionsState = Readonly<{
  readonly sections: readonly UiCatalogEntry[]
  readonly selectedPartKey: string | null
  readonly selectedSection: UiCatalogEntry | undefined
  readonly selectSection: (partKey: string) => void
}>

/**
 * Owns only the finite admin section collection and its local selection.
 * Surface-form knowledge belongs to assembly/catalog projection; this hook
 * receives the already selected catalog and never branches on that fact.
 */
export const useAdminSections = ({catalog, context}: UseAdminSectionsInput): AdminSectionsState => {
  const sections = useMemo(() => selectAdminSections(catalog, context), [catalog, context])
  const [requestedPartKey, setRequestedPartKey] = useState<string | null>(null)
  const selectedPartKey = requestedPartKey
  const selectedSection = requestedPartKey === null
    ? undefined
    : sections.find(section => section.partKey === requestedPartKey)
  const selectSection = useCallback((partKey: string) => {
    if (sections.some(section => section.partKey === partKey)) setRequestedPartKey(partKey)
  }, [sections])
  return Object.freeze({sections, selectedPartKey, selectedSection, selectSection})
}
