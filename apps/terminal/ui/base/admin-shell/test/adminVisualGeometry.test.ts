import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'
import {adminGeometry, baseTokens} from '@catering-v2s/ui-base-primitives'

const read = (relativePath: string): string => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

/**
 * Denominator copied from IA §3.2 and §3.3. Every row must have an executable
 * assertion below; adding an IA geometry row without adding its assertion is a
 * focused test failure at the contract boundary.
 */
const highFidelityGeometryRowIds = [
  'panel.shell',
  'panel.header',
  'panel.header.overall-status',
  'panel.nav.laptop',
  'panel.nav.mobile',
  'panel.content',
  'admin.page-title',
  'admin.section-title',
  'admin.card',
  'admin.primary-action',
  'admin.secondary-action',
  'admin.status',
  'admin.disclosure-row',
  'admin.ratio-bar',
  'admin.surface-map',
] as const

type HighFidelityGeometryRowId = typeof highFidelityGeometryRowIds[number]

const highFidelityGeometryAssertions: Record<HighFidelityGeometryRowId, () => void> = {
  'panel.shell': () => {
    expect(adminGeometry.shellLaptop).toMatchObject({flex: 1, width: '100%', maxWidth: '100%', minHeight: 0, minWidth: 0})
    expect(adminGeometry.shellMobile).toMatchObject({flex: 1, width: '100%', maxWidth: '100%', minHeight: 0, minWidth: 0})
  },
  'panel.header': () => {
    expect(adminGeometry.headerLaptop).toMatchObject({height: 72, paddingHorizontal: 24, borderBottomWidth: 1})
    expect(adminGeometry.headerMobile).toMatchObject({height: 60, paddingHorizontal: 16, borderBottomWidth: 1})
  },
  'panel.header.overall-status': () => {
    expect(baseTokens.adminStatus).toContain('min-h-7 min-w-28')
    expect(baseTokens.adminStatus).toContain('rounded-[14px]')
  },
  'panel.nav.laptop': () => {
    expect(adminGeometry.navigation).toMatchObject({width: 248, minWidth: 248, padding: 12, borderRadius: 16})
    expect(baseTokens.adminNav).toContain('rounded-2xl')
  },
  'panel.nav.mobile': () => {
    expect(baseTokens.adminMobileSelector).toContain('min-h-12')
    expect(baseTokens.adminMobileSelector).toContain('rounded-xl border-2')
  },
  'panel.content': () => {
    expect(adminGeometry.contentLaptop).toMatchObject({flex: 1, minHeight: 0, minWidth: 0, padding: 24})
    expect(adminGeometry.contentMobile).toMatchObject({flex: 1, minHeight: 0, minWidth: 0, padding: 16, gap: 12})
  },
  'admin.page-title': () => {
    expect(baseTokens.adminPageTitle).toContain('text-[22px] leading-[30px] font-bold')
  },
  'admin.section-title': () => {
    expect(baseTokens.adminSectionTitle).toContain('text-base leading-[22px] font-bold')
  },
  'admin.card': () => {
    expect(adminGeometry.card).toMatchObject({borderRadius: 16, borderWidth: 1, padding: 20, minHeight: 96})
  },
  'admin.primary-action': () => {
    expect(baseTokens.adminButton).toContain('min-h-11')
    expect(baseTokens.adminButton).toContain('rounded-xl')
  },
  'admin.secondary-action': () => {
    expect(baseTokens.adminButtonSecondary).toContain('min-h-11')
    expect(baseTokens.adminButtonSecondary).toContain('rounded-xl')
  },
  'admin.status': () => {
    expect(baseTokens.adminStatusDot).toContain('h-2 w-2 rounded-full')
  },
  'admin.disclosure-row': () => {
    expect(adminGeometry.disclosure).toMatchObject({minHeight: 52, paddingHorizontal: 16})
  },
  'admin.ratio-bar': () => {
    expect(adminGeometry.ratioBar).toMatchObject({height: 12, borderRadius: 6})
  },
  'admin.surface-map': () => {
    expect(adminGeometry.surfaceRectLaptop).toMatchObject({minWidth: 176, maxWidth: 320})
    expect(adminGeometry.surfaceRectMobile).toMatchObject({minWidth: 120})
    expect(read('../primitives/src/components/PrimitiveAdmin.tsx')).toContain('aspectRatio: surface.aspectRatio')
  },
}

describe('admin visual contract', () => {
  it('covers every high-fidelity row in IA §3.2 and §3.3', () => {
    expect(Object.keys(highFidelityGeometryAssertions).sort()).toEqual([...highFidelityGeometryRowIds].sort())
    for (const rowId of highFidelityGeometryRowIds) highFidelityGeometryAssertions[rowId]()
  })

  it('declares the high-fidelity geometry as focused data, not a frame macro', () => {
    expect(adminGeometry.rootLaptop).toMatchObject({paddingHorizontal: 0, paddingVertical: 0})
    expect(adminGeometry.rootMobile).toMatchObject({paddingHorizontal: 0, paddingVertical: 0})
    expect(adminGeometry.shellLaptop).toMatchObject({flex: 1, width: '100%', maxWidth: '100%', minHeight: 0, minWidth: 0, alignSelf: 'stretch'})
    expect(adminGeometry.shellMobile).toMatchObject({flex: 1, width: '100%', maxWidth: '100%', minHeight: 0, minWidth: 0, alignSelf: 'stretch'})
    expect(adminGeometry.headerLaptop).toMatchObject({height: 72, paddingHorizontal: 24, borderBottomWidth: 1})
    expect(adminGeometry.headerMobile).toMatchObject({height: 60, paddingHorizontal: 16, borderBottomWidth: 1})
    expect(adminGeometry.navigation).toMatchObject({width: 248, minWidth: 248, padding: 12, borderRightWidth: 1, borderRadius: 16})
    expect(adminGeometry.navigationList).toMatchObject({gap: 6})
    expect(adminGeometry.contentLaptop).toMatchObject({padding: 24})
    expect(adminGeometry.contentMobile).toMatchObject({padding: 16, gap: 12})
    expect(adminGeometry.card).toMatchObject({borderRadius: 16, borderWidth: 1, padding: 20, minHeight: 96})
    expect(adminGeometry.disclosure).toMatchObject({minHeight: 52, paddingHorizontal: 16})
    expect(adminGeometry.ratioBar).toMatchObject({height: 12, borderRadius: 6})
    expect(adminGeometry.surfaceRectLaptop).toMatchObject({minWidth: 176, maxWidth: 320})
    expect(adminGeometry.surfaceRectMobile).toMatchObject({minWidth: 120})
  })

  it('uses admin semantic classes at the shared-rendering boundaries', () => {
    expect(baseTokens.adminShell).toContain('bg-admin-shell-surface')
    expect(baseTokens.adminShell).toContain('border-admin-shell-border')
    expect(baseTokens.adminShell).not.toContain('rounded-[20px]')
    expect(baseTokens.adminShell).not.toContain('shadow-2xl')
    expect(baseTokens.adminNav).toContain('rounded-2xl')
    expect(baseTokens.adminNavItemSelected).toContain('bg-admin-action')
    expect(baseTokens.adminNavFocusBar).toContain('bg-admin-focus')
    expect(baseTokens.adminContent).toContain('bg-admin-content-surface')
    expect(baseTokens.adminCard).toContain('bg-surface-elevated')
    expect(baseTokens.adminRatioBar).toContain('bg-admin-inset')
    expect(baseTokens.adminDisclosureTrigger).toContain('flex-row')
    expect(read('src/components/AdminShellFrameLaptop.tsx')).toContain('appearance="admin-shell"')
    expect(read('src/components/AdminShellFrameMobile.tsx')).toContain('appearance="admin-shell-mobile"')
    expect(read('src/components/AdminSectionNavigationLaptop.tsx')).toContain('variant="admin-nav"')
    expect(read('src/components/AdminSectionNavigationLaptop.tsx')).toContain('icon=')
    expect(read('../primitives/src/components/PrimitiveAdmin.tsx')).toContain('height: adminGeometry.surfaceRectLaptop.maxWidth / surface.aspectRatio')
    expect(read('../primitives/src/components/PrimitiveAdmin.tsx')).toContain('aspectRatio: surface.aspectRatio')
    const primitiveAdminSource = read('../primitives/src/components/PrimitiveAdmin.tsx')
    expect(primitiveAdminSource).toContain('testID={`${address}:surface:${surface.key}:frame`}')
    const frameStart = primitiveAdminSource.indexOf('testID={`${address}:surface:${surface.key}:frame`}')
    const surfaceStart = primitiveAdminSource.indexOf('testID={`${address}:surface:${surface.key}`}')
    const logicWidthStart = primitiveAdminSource.indexOf('logic-width', surfaceStart)
    const logicHeightStart = primitiveAdminSource.indexOf('logic-height', surfaceStart)
    const surfaceClose = primitiveAdminSource.indexOf('</RnrView>', surfaceStart)
    const physicalWidthStart = primitiveAdminSource.indexOf('outside:0')
    const physicalHeightStart = primitiveAdminSource.indexOf('outside:1', frameStart)
    const frameClose = primitiveAdminSource.indexOf('</RnrView>', surfaceClose + 1)
    expect(frameStart).toBeGreaterThanOrEqual(0)
    expect(surfaceStart).toBeGreaterThan(frameStart)
    expect(physicalWidthStart).toBeLessThan(frameStart)
    expect(logicWidthStart).toBeGreaterThan(surfaceStart)
    expect(logicWidthStart).toBeLessThan(surfaceClose)
    expect(logicHeightStart).toBeGreaterThan(surfaceStart)
    expect(logicHeightStart).toBeLessThan(surfaceClose)
    expect(physicalHeightStart).toBeGreaterThan(surfaceClose)
    expect(physicalHeightStart).toBeLessThan(frameClose)
  })

  it('freezes the high-fidelity shape contract for every shared admin control family', () => {
    expect(baseTokens.adminHeaderTitle).toContain('text-2xl leading-8 font-bold')
    expect(baseTokens.adminHeaderClose).toContain('min-h-7 min-w-7')
    expect(baseTokens.adminHeaderClose).toContain('rounded-[9px]')
    expect(baseTokens.adminStatus).toContain('min-h-7 min-w-28')
    expect(baseTokens.adminStatus).toContain('rounded-[14px]')
    expect(baseTokens.adminNavItem).toContain('min-h-11 flex-row')
    expect(baseTokens.adminNavItemSelected).toContain('bg-admin-action')
    expect(baseTokens.adminButton).toContain('min-h-11')
    expect(baseTokens.adminButton).toContain('rounded-xl')
    expect(baseTokens.adminButtonDisabled).toContain('bg-admin-inset')
    expect(baseTokens.adminButtonDisabledText).toContain('text-admin-content-muted')
    expect(baseTokens.adminPortItem).toContain('flex-row flex-wrap')
    expect(baseTokens.adminPortItemMeta).toContain('text-xs')
    expect(baseTokens.adminButtonSecondary).toContain('min-h-11')
    expect(baseTokens.adminButtonSecondary).toContain('rounded-xl')
    expect(baseTokens.adminMobileSelector).toContain('min-h-12')
    expect(baseTokens.adminMobileSelector).toContain('rounded-xl border-2')
    expect(baseTokens.adminDisclosureTrigger).toContain('min-h-[52px] flex-row')
    expect(baseTokens.adminRatioBar).toContain('h-3')
    expect(baseTokens.adminSurfaceMapRect).not.toContain('min-h-44')
    expect(baseTokens.adminSurfaceMapRect).toContain('relative')
    expect(baseTokens.adminSurfaceMapRectCurrent).toContain('border-2 border-admin-focus')
    expect(baseTokens.adminSurfaceMapFrame).toContain('relative')
    expect(baseTokens.adminSurfaceMapLogicWidth).toContain('left-0 right-0 top-2')
    expect(baseTokens.adminSurfaceMapLogicWidth).toContain('text-center')
    expect(baseTokens.adminSurfaceMapLogicHeight).not.toContain('rotate-90')
    expect(baseTokens.adminSurfaceMapLogicHeight).toContain('right-2 top-1/2')
    expect(baseTokens.adminSurfaceMapPhysicalWidth).toContain('top-0')
    expect(baseTokens.adminSurfaceMapPhysicalHeight).not.toContain('rotate-90')
    expect(baseTokens.adminSurfaceMapPhysicalHeight).toContain('left-full top-1/2')
    expect(baseTokens.adminSurfaceMapWrap).toContain('pb-12')
  })

  it('binds aspect ratio to the inner surface rectangle with the native laptop fallback height', () => {
    const source = read('../primitives/src/components/PrimitiveAdmin.tsx')
    const cardStart = source.indexOf('testID={`${address}:surface:${surface.key}:card`}')
    const innerStart = source.indexOf('testID={`${address}:surface:${surface.key}`}', cardStart)
    expect(cardStart).toBeGreaterThanOrEqual(0)
    expect(innerStart).toBeGreaterThan(cardStart)
    expect(source.slice(cardStart, innerStart)).not.toContain('aspectRatio')
    const ratioStart = source.indexOf('aspectRatio: surface.aspectRatio', innerStart)
    expect(ratioStart).toBeGreaterThan(innerStart)
    expect(source.slice(innerStart, ratioStart)).toContain('height: adminGeometry.surfaceRectLaptop.maxWidth / surface.aspectRatio')
    expect(source.slice(innerStart, ratioStart)).toContain("width: '100%'")
    expect(source.slice(innerStart, ratioStart)).not.toContain('minHeight')
  })

  it('keeps runtime fact controls and action gradients on semantic shared boundaries', () => {
    const runtimeLaptop = read('src/components/sections/RuntimeSectionLaptop.tsx')
    const runtimeMobile = read('src/components/sections/RuntimeSectionMobile.tsx')
    const portsLaptop = read('src/components/sections/PlatformPortsSectionLaptop.tsx')
    const portsMobile = read('src/components/sections/PlatformPortsSectionMobile.tsx')
    const button = read('../primitives/src/components/PrimitiveButton.tsx')
    for (const source of [runtimeLaptop, runtimeMobile]) {
      expect(source).toContain('admin.console.runtime:environment')
      expect(source).toContain('admin.console.runtime:debug')
      expect(source).toContain('admin.console.runtime:device')
      expect(source).toContain('admin.console.runtime:display-status')
      expect(source).not.toContain('surfaceForm ===')
    }
    expect(runtimeLaptop).toContain('surfaceForm: \'laptop\'')
    expect(runtimeLaptop).toContain('columns={3}')
    expect(runtimeMobile).toContain('surfaceForm: \'mobile\'')
    expect(runtimeMobile).toContain('columns={1}')
    expect(portsLaptop).toContain("portsFrameId('laptop'")
    expect(portsLaptop).toContain('columns={3}')
    expect(portsMobile).toContain("portsFrameId('mobile'")
    expect(portsMobile).toContain('columns={1}')
    expect(portsLaptop).not.toContain('surfaceForm ===')
    expect(portsMobile).not.toContain('surfaceForm ===')
    expect(button).toContain("namespace={appearance === 'admin-primary' ? 'admin' : 'login'}")
    expect(button).toContain('--color-${namespace}-action-start')
    expect(button).toContain('--color-${namespace}-action-end')
  })

  it('keeps the four known false-green regressions mechanically visible', () => {
    const adminShell = read('src/components/AdminShellFrameLaptop.tsx')
    const navigation = read('src/components/AdminSectionNavigationLaptop.tsx')
    const primitiveAdmin = read('../primitives/src/components/PrimitiveAdmin.tsx')
    const selection = read('src/foundations/adminSectionSelection.ts')
    expect(adminShell).toContain('adminGeometry.shellLaptop')
    expect(navigation).toContain('adminGeometry.navigationList')
    expect(primitiveAdmin).toContain(':card')
    expect(primitiveAdmin).not.toContain('style={{aspectRatio: surface.aspectRatio}}')
    expect(selection).not.toContain('pageKey: undefined')
  })
})
