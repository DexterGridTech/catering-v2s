import {act, create, type ReactTestRenderer} from 'react-test-renderer'
import {describe, expect, it} from 'vitest'
import {createUiCatalog, type UiCatalogContext} from '@catering-v2s/kernel-base-ui-state'
import {ADMIN_SECTION_CONTAINER_KEY} from '../src/foundations/adminIdentity'
import {useAdminSections, type AdminSectionsState} from '../src/hooks/useAdminSections'

const context: UiCatalogContext = {
  displayMode: 'PRIMARY',
  workspace: 'MAIN',
  instanceMode: 'MASTER',
  surfaceForm: 'laptop',
}

const entry = (partKey: string, title: string) => ({
  partKey,
  rendererKey: `${partKey}.laptop`,
  containerKeys: [ADMIN_SECTION_CONTAINER_KEY] as const,
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  surfaceForm: ['laptop'] as const,
  title,
  description: `${title} description`,
})

const Probe = ({
  catalog,
  onState,
}: Readonly<{
  readonly catalog: ReturnType<typeof createUiCatalog>
  readonly onState: (state: AdminSectionsState) => void
}>) => {
  const state = useAdminSections({catalog, context})
  onState(state)
  return null
}

describe('useAdminSections', () => {
  it('keeps the raw selection local and rejects unknown keys without choosing a form fallback', () => {
    const catalog = createUiCatalog([
      entry('admin.console.runtime', '运行状态'),
      entry('admin.console.display-context', '显示上下文'),
    ])
    let state: AdminSectionsState | undefined
    let renderer: ReactTestRenderer | undefined
    act(() => {
      renderer = create(<Probe catalog={catalog} onState={next => { state = next }} />)
    })
    expect(state?.sections.map(section => section.partKey)).toEqual([
      'admin.console.runtime',
      'admin.console.display-context',
    ])
    expect(state?.selectedPartKey).toBeNull()
    expect(state?.selectedSection).toBeUndefined()

    act(() => { state?.selectSection('admin.console.display-context') })
    expect(state?.selectedPartKey).toBe('admin.console.display-context')
    expect(state?.selectedSection?.title).toBe('显示上下文')

    act(() => { state?.selectSection('admin.console.not-in-catalog') })
    expect(state?.selectedPartKey).toBe('admin.console.display-context')
    renderer?.unmount()
  })
})
