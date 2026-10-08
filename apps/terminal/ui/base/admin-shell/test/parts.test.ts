import {describe, expect, it} from 'vitest';
import {parts} from '../src/parts/parts';
import {adminTestIds} from '../src/foundations/adminTestIds';

const normalizeCatalogEntry = (entry: (typeof parts)[number]['catalogEntry']) => ({
  partKey: entry.partKey,
  containerKeys: entry.containerKeys,
  displayModes: entry.displayModes,
  workspaces: entry.workspaces,
  instanceModes: entry.instanceModes,
  title: entry.title,
  description: entry.description,
});

describe('admin-shell R-10a part declarations', () => {
  it('keeps navigation tab identifiers distinct from rendered section content roots', () => {
    for (const [section, expected] of [
      [adminTestIds.ports, adminTestIds.node('terminal.admin:ports:content-root')],
      [adminTestIds.runtime, adminTestIds.node('terminal.admin:runtime:content-root')],
      [adminTestIds.topology, adminTestIds.node('terminal.admin:topology:content-root')],
    ] as const) {
      expect(section.contentRoot).not.toBe(section.section);
      expect(section.contentRoot).toBe(expected);
    }
    expect(
      new Set([adminTestIds.ports.contentRoot, adminTestIds.runtime.contentRoot, adminTestIds.topology.contentRoot])
        .size,
    ).toBe(3);
  });

  it('contains two non-overlapping siblings for every admin part key', () => {
    expect(parts).toHaveLength(12);
    const groups = new Map<string, (typeof parts)[number][]>();
    for (const part of parts) {
      const siblings = groups.get(part.catalogEntry.partKey) ?? [];
      siblings.push(part);
      groups.set(part.catalogEntry.partKey, siblings);
    }

    expect([...groups.keys()].sort()).toEqual([
      'admin.console',
      'admin.console.display-context',
      'admin.console.platform-ports',
      'admin.console.power-confirmation',
      'admin.console.runtime',
      'admin.console.topology',
    ]);
    for (const siblings of groups.values()) {
      expect(siblings).toHaveLength(2);
      expect(siblings.map(part => part.catalogEntry.surfaceForm).sort()).toEqual([['laptop'], ['mobile']]);
      expect(new Set(siblings.map(part => part.rendererBinding.rendererKey)).size).toBe(2);
      expect(new Set(siblings.map(part => part.rendererBinding.component)).size).toBe(2);
      for (const sibling of siblings) {
        const surfaceForm = sibling.catalogEntry.surfaceForm[0];
        expect(sibling.rendererBinding.rendererKey).toBe(`${sibling.catalogEntry.partKey}.${surfaceForm}`);
        expect(sibling.rendererBinding.component.name).toContain(surfaceForm === 'laptop' ? 'Laptop' : 'Mobile');
      }
    }
    expect(new Set(parts.map(part => part.rendererBinding.rendererKey)).size).toBe(12);
  });

  it('keeps every sibling semantic field and layer binding equal after definePart normalization', () => {
    const groups = new Map<string, (typeof parts)[number][]>();
    for (const part of parts) {
      const siblings = groups.get(part.catalogEntry.partKey) ?? [];
      siblings.push(part);
      groups.set(part.catalogEntry.partKey, siblings);
    }
    for (const siblings of groups.values()) {
      const [first, second] = siblings;
      expect(normalizeCatalogEntry(first!.catalogEntry)).toEqual(normalizeCatalogEntry(second!.catalogEntry));
      expect(first!.rendererBinding.layerTier).toBe(second!.rendererBinding.layerTier);
      expect(first!.rendererBinding.layerGuard).toBe(second!.rendererBinding.layerGuard);
    }
    const adminConsoleSiblings = groups.get('admin.console')!;
    expect(adminConsoleSiblings.every(part => part.rendererBinding.layerGuard === 'decisive')).toBe(true);
    const powerConfirmationSiblings = groups.get('admin.console.power-confirmation')!;
    expect(powerConfirmationSiblings.every(part => part.rendererBinding.layerTier === 'admin')).toBe(true);
    expect(powerConfirmationSiblings.every(part => part.rendererBinding.layerGuard === 'decisive')).toBe(true);
    expect(
      parts
        .filter(part => !['admin.console', 'admin.console.power-confirmation'].includes(part.catalogEntry.partKey))
        .every(part => part.rendererBinding.layerGuard === 'dismissible'),
    ).toBe(true);
  });
});
