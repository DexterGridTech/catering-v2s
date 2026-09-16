import {describe, expect, it} from 'vitest'
import {definePart} from '@catering-v2s/ui-base-render'
import {adminShellAssembly} from '@catering-v2s/ui-base-admin-shell'
import {selectPartsForSurfaceForm} from '../src/foundations/consoleAssembly'

const makePart = (partKey: string, surfaceForm: readonly ('laptop' | 'mobile')[], rendererKey: string) =>
  definePart({
    partKey,
    rendererKey,
    containerKeys: ['main'] as const,
    displayModes: ['PRIMARY'] as const,
    workspaces: ['MAIN'] as const,
    instanceModes: ['MASTER'] as const,
    surfaceForm: surfaceForm as TestPart['catalogEntry']['surfaceForm'],
    title: partKey,
    description: partKey,
    component: () => null,
  })

type TestPart = Parameters<typeof selectPartsForSurfaceForm>[0][number]

const makeRawPart = (partKey: string, surfaceForm: readonly string[]): TestPart => ({
  catalogEntry: {
    partKey,
    rendererKey: `${partKey}.raw`,
    containerKeys: ['main'],
    displayModes: ['PRIMARY'],
    workspaces: ['MAIN'],
    instanceModes: ['MASTER'],
    surfaceForm: surfaceForm as TestPart['catalogEntry']['surfaceForm'],
    title: partKey,
    description: partKey,
  },
  rendererBinding: {
    rendererKey: `${partKey}.raw`,
    component: () => null,
    layerTier: 'standard',
    layerGuard: 'dismissible',
  },
})

describe('console assembly surface-form admission', () => {
  it('selects one disjoint sibling for each requested surface form', () => {
    const parts = [
      makePart('sample.form-part', ['laptop'], 'sample.form-part.laptop'),
      makePart('sample.form-part', ['mobile'], 'sample.form-part.mobile'),
      makePart('sample.shared-part', ['laptop', 'mobile'], 'sample.shared-part'),
    ]

    expect(selectPartsForSurfaceForm(parts, 'laptop').map(part => part.rendererBinding.rendererKey)).toEqual([
      'sample.form-part.laptop',
      'sample.shared-part',
    ])
    expect(selectPartsForSurfaceForm(parts, 'mobile').map(part => part.rendererBinding.rendererKey)).toEqual([
      'sample.form-part.mobile',
      'sample.shared-part',
    ])
  })

  it('rejects an overlap before filtering to the requested form', () => {
    const parts = [
      makePart('sample.overlap', ['laptop'], 'sample.overlap.laptop'),
      makePart('sample.overlap', ['laptop', 'mobile'], 'sample.overlap.other'),
    ]

    expect(() => selectPartsForSurfaceForm(parts, 'mobile')).toThrow(
      /overlapping surfaceForm for sample\.overlap: laptop/,
    )
  })

  it('rejects empty or duplicate declarations before catalog creation', () => {
    const empty = makeRawPart('sample.empty', [])
    const duplicate = makeRawPart('sample.duplicate', ['laptop', 'laptop'])

    expect(() => selectPartsForSurfaceForm([empty], 'laptop')).toThrow(/empty surfaceForm/)
    expect(() => selectPartsForSurfaceForm([duplicate], 'laptop')).toThrow(/duplicate surfaceForm/)
  })

  it('rejects overlap in the real R-10a admin sibling fixture for either requested form', () => {
    const siblings = adminShellAssembly.parts.filter(part =>
      part.catalogEntry.partKey === 'admin.console.platform-ports')
    expect(siblings).toHaveLength(2)
    const overlapping = [
      siblings[0]!,
      {
        ...siblings[1]!,
        catalogEntry: {
          ...siblings[1]!.catalogEntry,
          surfaceForm: ['laptop', 'mobile'] as const,
        },
      },
    ]

    expect(() => selectPartsForSurfaceForm(overlapping, 'laptop')).toThrow(
      /overlapping surfaceForm for admin\.console\.platform-ports: laptop/,
    )
    expect(() => selectPartsForSurfaceForm(overlapping, 'mobile')).toThrow(
      /overlapping surfaceForm for admin\.console\.platform-ports: laptop/,
    )
  })
})
