import {describe, expect, it} from 'vitest'
import {parts} from '../src/parts/parts'

const normalizeCatalogEntry = (entry: (typeof parts)[number]['catalogEntry']) => ({
  partKey: entry.partKey,
  containerKeys: entry.containerKeys,
  displayModes: entry.displayModes,
  workspaces: entry.workspaces,
  instanceModes: entry.instanceModes,
  title: entry.title,
  description: entry.description,
})

describe('admin-shell R-10a part declarations', () => {
  it('contains two non-overlapping siblings for every admin part key', () => {
    expect(parts).toHaveLength(8)
    const groups = new Map<string, typeof parts[number][]>()
    for (const part of parts) {
      const siblings = groups.get(part.catalogEntry.partKey) ?? []
      siblings.push(part)
      groups.set(part.catalogEntry.partKey, siblings)
    }

    expect([...groups.keys()].sort()).toEqual([
      'admin.console',
      'admin.console.display-context',
      'admin.console.platform-ports',
      'admin.console.runtime',
    ])
    for (const siblings of groups.values()) {
      expect(siblings).toHaveLength(2)
      expect(siblings.map(part => part.catalogEntry.surfaceForm).sort()).toEqual([
        ['laptop'],
        ['mobile'],
      ])
      expect(new Set(siblings.map(part => part.rendererBinding.rendererKey)).size).toBe(2)
      expect(new Set(siblings.map(part => part.rendererBinding.component)).size).toBe(2)
    }
    expect(new Set(parts.map(part => part.rendererBinding.rendererKey)).size).toBe(8)
  })

  it('keeps every sibling semantic field and layer binding equal after definePart normalization', () => {
    const groups = new Map<string, typeof parts[number][]>()
    for (const part of parts) {
      const siblings = groups.get(part.catalogEntry.partKey) ?? []
      siblings.push(part)
      groups.set(part.catalogEntry.partKey, siblings)
    }
    for (const siblings of groups.values()) {
      const [first, second] = siblings
      expect(normalizeCatalogEntry(first!.catalogEntry)).toEqual(normalizeCatalogEntry(second!.catalogEntry))
      expect(first!.rendererBinding.layerTier).toBe(second!.rendererBinding.layerTier)
      expect(first!.rendererBinding.layerGuard).toBe(second!.rendererBinding.layerGuard)
    }
    const adminConsoleSiblings = groups.get('admin.console')!
    expect(adminConsoleSiblings.every(part => part.rendererBinding.layerGuard === 'decisive')).toBe(true)
    expect(parts.filter(part => part.catalogEntry.partKey !== 'admin.console')
      .every(part => part.rendererBinding.layerGuard === 'dismissible')).toBe(true)
  })
})
