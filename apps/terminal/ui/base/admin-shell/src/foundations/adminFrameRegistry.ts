import type {TopologyFacts, TopologyOperation} from '@catering-v2s/kernel-base-contracts'
import type {DisplayFactsReadModel} from '@catering-v2s/kernel-base-display-context'
import {createContext, useCallback, useContext, useEffect, useState} from 'react'
import {adminTestIds} from './adminTestIds'
import {portCategoryOrder} from './portProjection'

/**
 * The implementation-facing IA denominator.  A frame is a named renderer
 * state, not a screenshot filename: the renderer, fixture key and root
 * testID must stay bound together so a dynamic capture cannot silently fall
 * back to a merely similar page.
 */
export type AdminFrameId =
  | 'IA-01' | 'IA-02' | 'IA-03' | 'IA-04' | 'IA-05' | 'IA-06' | 'IA-07' | 'IA-08'
  | 'IA-09' | 'IA-10' | 'IA-11' | 'IA-12' | 'IA-13' | 'IA-14' | 'IA-15' | 'IA-16'
  | 'IA-17' | 'IA-18' | 'IA-19' | 'IA-20' | 'IA-21' | 'IA-22' | 'IA-23' | 'IA-24'
  | 'IA-25' | 'IA-26' | 'IA-27' | 'IA-28' | 'IA-29' | 'IA-32'

export type AdminFrameRendererKey =
  | 'AdminShellFrameLaptop'
  | 'AdminShellFrameMobile'
  | 'AdminPanelStateCardLaptop'
  | 'AdminPanelStateCardMobile'
  | 'PlatformPortsSectionLaptop'
  | 'PlatformPortsSectionMobile'
  | 'RuntimeSectionLaptop'
  | 'RuntimeSectionMobile'
  | 'TopologySectionLaptop'
  | 'TopologySectionMobile'
  | 'CrossTabAudit'

export type AdminFrameBindingKind = 'production-renderer' | 'artifact-only'

export type AdminFrameVariant = Readonly<{
  readonly id: string
  readonly controlTestIDs: readonly string[]
  readonly mustNotTestIDs: readonly string[]
}>

export type AdminFrameDefinition = Readonly<{
  readonly id: AdminFrameId
  readonly name: string
  readonly renderer: AdminFrameRendererKey
  readonly bindingKind: AdminFrameBindingKind
  readonly fixture: AdminFrameFixtureKey
  readonly rootTestID: string
  readonly controlTestIDs: readonly string[]
  readonly variants: readonly AdminFrameVariant[]
}>

export type AdminFrameFixture = Readonly<{
  readonly surfaceForm: 'laptop' | 'mobile'
  readonly page: 'panel' | 'ports' | 'runtime' | 'topology' | 'cross-tab'
  readonly state: string
  readonly expandedCategory?: 'logs' | null
  readonly expandedUnitKeys?: readonly string[]
}>

type AdminFrameFixtureOptions = Readonly<{
  readonly surfaceForm: AdminFrameFixture['surfaceForm']
  readonly page: AdminFrameFixture['page']
  readonly state: string
  readonly expandedCategory?: AdminFrameFixture['expandedCategory']
  readonly expandedUnitKeys?: readonly string[]
}>

const fixture = ({surfaceForm, page, state, expandedCategory, expandedUnitKeys}: AdminFrameFixtureOptions): AdminFrameFixture => Object.freeze({surfaceForm, page, state, ...(expandedCategory === undefined ? {} : {expandedCategory}), ...(expandedUnitKeys === undefined ? {} : {expandedUnitKeys: Object.freeze([...expandedUnitKeys])})})

export const adminFrameFixtures = Object.freeze({
  'panel.laptop.normal': fixture({surfaceForm: 'laptop', page: 'panel', state: 'normal'}),
  'panel.mobile.normal': fixture({surfaceForm: 'mobile', page: 'panel', state: 'normal'}),
  'panel.laptop.empty': fixture({surfaceForm: 'laptop', page: 'panel', state: 'empty'}),
  'panel.mobile.empty': fixture({surfaceForm: 'mobile', page: 'panel', state: 'empty'}),
  'panel.laptop.loading': fixture({surfaceForm: 'laptop', page: 'panel', state: 'loading'}),
  'panel.mobile.loading': fixture({surfaceForm: 'mobile', page: 'panel', state: 'loading'}),
  'panel.laptop.error': fixture({surfaceForm: 'laptop', page: 'panel', state: 'error'}),
  'panel.mobile.error': fixture({surfaceForm: 'mobile', page: 'panel', state: 'error'}),
  'ports.laptop.overview': fixture({surfaceForm: 'laptop', page: 'ports', state: 'overview'}),
  'ports.mobile.overview': fixture({surfaceForm: 'mobile', page: 'ports', state: 'overview'}),
  'ports.laptop.category-expanded': fixture({surfaceForm: 'laptop', page: 'ports', state: 'category-expanded', expandedCategory: 'logs', expandedUnitKeys: ['logger:info', 'logUpload:uploadLogsForDate']}),
  'ports.mobile.category-expanded': fixture({surfaceForm: 'mobile', page: 'ports', state: 'category-expanded', expandedCategory: 'logs', expandedUnitKeys: ['logger:info', 'logUpload:uploadLogsForDate']}),
  'runtime.laptop.single-surface': fixture({surfaceForm: 'laptop', page: 'runtime', state: 'single-surface'}),
  'runtime.mobile.single-surface': fixture({surfaceForm: 'mobile', page: 'runtime', state: 'single-surface'}),
  'runtime.laptop.dual-surface': fixture({surfaceForm: 'laptop', page: 'runtime', state: 'dual-surface'}),
  'topology.laptop.unavailable': fixture({surfaceForm: 'laptop', page: 'topology', state: 'unavailable'}),
  'topology.mobile.unavailable': fixture({surfaceForm: 'mobile', page: 'topology', state: 'unavailable'}),
  'topology.laptop.role-choice': fixture({surfaceForm: 'laptop', page: 'topology', state: 'role-choice'}),
  'topology.laptop.host-starting': fixture({surfaceForm: 'laptop', page: 'topology', state: 'host-starting'}),
  'topology.laptop.host-ready': fixture({surfaceForm: 'laptop', page: 'topology', state: 'host-ready'}),
  'topology.laptop.host-error': fixture({surfaceForm: 'laptop', page: 'topology', state: 'host-error'}),
  'topology.laptop.pairing': fixture({surfaceForm: 'laptop', page: 'topology', state: 'pairing'}),
  'topology.laptop.pair-error': fixture({surfaceForm: 'laptop', page: 'topology', state: 'pair-error'}),
  'topology.laptop.master-paired-reachable': fixture({surfaceForm: 'laptop', page: 'topology', state: 'master-paired-reachable'}),
  'topology.laptop.master-paired-reconnecting': fixture({surfaceForm: 'laptop', page: 'topology', state: 'master-paired-reconnecting'}),
  'topology.laptop.unpairing-master': fixture({surfaceForm: 'laptop', page: 'topology', state: 'unpairing-master'}),
  'topology.laptop.slave-paired-reachable': fixture({surfaceForm: 'laptop', page: 'topology', state: 'slave-paired-reachable'}),
  'topology.laptop.slave-paired-reconnecting': fixture({surfaceForm: 'laptop', page: 'topology', state: 'slave-paired-reconnecting'}),
  'topology.laptop.unpairing-slave': fixture({surfaceForm: 'laptop', page: 'topology', state: 'unpairing-slave'}),
  'cross-tab.laptop.dual-physical': fixture({surfaceForm: 'laptop', page: 'cross-tab', state: 'dual-physical'}),
})

export type AdminFrameFixtureKey = keyof typeof adminFrameFixtures

const frameTestId = (id: AdminFrameId): string => `terminal.admin:frame:${id}`

const panelControls = Object.freeze([
  adminTestIds.panel.frame,
  adminTestIds.panel.header,
  adminTestIds.panel.brand,
  'terminal.admin:shell:title',
  adminTestIds.panel.status,
  adminTestIds.close,
])

const laptopPanelControls = Object.freeze([
  ...panelControls,
  'terminal.admin:navigation',
  adminTestIds.section('admin.console.platform-ports'),
  adminTestIds.section('admin.console.runtime'),
  adminTestIds.section('admin.console.topology'),
  adminTestIds.content,
])

const mobilePanelControls = Object.freeze([
  ...panelControls,
  'terminal.admin:navigation',
  'terminal.admin:navigation:trigger',
  adminTestIds.content,
])

const portCategoryControls = Object.freeze(portCategoryOrder.flatMap(category => [
  adminTestIds.ports.category(category, 'row'),
  adminTestIds.ports.category(category, 'status'),
  adminTestIds.ports.category(category, 'count'),
  adminTestIds.ports.category(category, 'expand'),
]))

const portsOverviewControls = Object.freeze([
  ...laptopPanelControls,
  'admin.console.platform-ports:scroll',
  adminTestIds.ports.title,
  adminTestIds.ports.overallStatus,
  'admin.console.platform-ports:total',
  adminTestIds.ports.summary.available,
  adminTestIds.ports.summary.unavailable,
  adminTestIds.ports.summary.undeclared,
  adminTestIds.ports.summary.ratioBar,
  adminTestIds.ports.summary.grid,
  ...portCategoryControls,
])

const portsMobileOverviewControls = Object.freeze([
  ...mobilePanelControls,
  'admin.console.platform-ports:scroll',
  adminTestIds.ports.title,
  adminTestIds.ports.overallStatus,
  'admin.console.platform-ports:total',
  adminTestIds.ports.summary.available,
  adminTestIds.ports.summary.unavailable,
  adminTestIds.ports.summary.undeclared,
  adminTestIds.ports.summary.ratioBar,
  adminTestIds.ports.summary.grid,
  ...portCategoryControls,
])

const runtimeLaptopControls = Object.freeze([
  ...laptopPanelControls,
  'admin.console.runtime:scroll',
  adminTestIds.runtime.title,
  adminTestIds.runtime.overallStatus,
  'admin.console.runtime:facts',
  'admin.console.runtime:environment',
  'admin.console.runtime:debug',
  'admin.console.runtime:device',
  'admin.console.runtime:display-status',
  adminTestIds.runtime.physicalDisplayCount,
  adminTestIds.runtime.surfaceMap,
  'admin.console.runtime:surface-card',
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:card`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:label`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:role`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:0`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:1`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:2`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-width`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-height`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:0`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:1`,
  adminTestIds.runtime.legend,
])

const runtimeMobileBaseControls = Object.freeze([
  ...mobilePanelControls,
  'admin.console.runtime:scroll',
  adminTestIds.runtime.title,
  adminTestIds.runtime.overallStatus,
  'admin.console.runtime:facts',
  'admin.console.runtime:environment',
  'admin.console.runtime:debug',
  'admin.console.runtime:device',
  'admin.console.runtime:display-status',
  adminTestIds.runtime.physicalDisplayCount,
])

const runtimeMobileReadyControls = Object.freeze([
  adminTestIds.runtime.mobileSingleSurfaceBoundary,
  adminTestIds.runtime.surfaceMap,
  'admin.console.runtime:surface-card',
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:card`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:label`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:role`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:0`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:1`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:inside:2`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-width`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:logic-height`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:0`,
  `${adminTestIds.runtime.surfaceMap}:surface:PRIMARY:outside:1`,
  adminTestIds.runtime.legend,
])

const runtimeMobileErrorControls = Object.freeze([
  adminTestIds.runtime.displayFactsError,
])

const runtimeDualLaptopControls = Object.freeze([
  ...runtimeLaptopControls,
  `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:card`,
  `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:label`,
  `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY`,
  `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:role`,
  `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:inside:0`,
  `${adminTestIds.runtime.surfaceMap}:surface:SECONDARY:inside:1`,
])

const portsExpandedItemControls = Object.freeze(['logger:info', 'logUpload:uploadLogsForDate'].flatMap(unitKey => [
  adminTestIds.ports.item(unitKey, 'name'),
  adminTestIds.ports.item(unitKey, 'status'),
  adminTestIds.ports.item(unitKey, 'reason'),
  adminTestIds.ports.item(unitKey, 'source'),
]))

const topologyLaptopBaseControls = Object.freeze([
  ...laptopPanelControls,
  adminTestIds.topology.scroll,
  adminTestIds.topology.title,
])

const topologyMobileControls = Object.freeze([
  ...mobilePanelControls,
  adminTestIds.topology.section,
  adminTestIds.topology.scroll,
  adminTestIds.topology.title,
  adminTestIds.topology.pageGate,
  adminTestIds.topology.pageGateReason,
])

const topologyUnavailableLaptopControls = Object.freeze([
  ...topologyLaptopBaseControls,
  `${adminTestIds.topology.pageGate}:card`,
  `${adminTestIds.topology.pageGate}:icon`,
  adminTestIds.topology.pageGate,
  adminTestIds.topology.pageGateReason,
])

const topologyRoleChoiceControls = Object.freeze([
  ...topologyLaptopBaseControls,
  adminTestIds.topology.pairResult,
  adminTestIds.topology.goalChoice,
  adminTestIds.topology.goalHost,
  `${adminTestIds.topology.goalHost}:icon`,
  adminTestIds.topology.goalSlave,
  `${adminTestIds.topology.goalSlave}:icon`,
  adminTestIds.topology.hostIp,
  adminTestIds.topology.host,
  adminTestIds.topology.pair,
  adminTestIds.topology.action('host-enable'),
])

const topologyHostStartingControls = Object.freeze([
  ...topologyLaptopBaseControls,
  adminTestIds.topology.pairResult,
  adminTestIds.topology.hostService,
  adminTestIds.topology.hostServiceState,
  adminTestIds.topology.enable,
  `${adminTestIds.topology.enable}:busy-indicator`,
])

const topologyHostReadyControls = Object.freeze([
  ...topologyLaptopBaseControls,
  adminTestIds.topology.pairResult,
  adminTestIds.topology.hostService,
  `${adminTestIds.topology.hostService}:facts`,
  adminTestIds.topology.role,
  adminTestIds.topology.hostServiceState,
  adminTestIds.topology.hostIp,
  `${adminTestIds.topology.hostService}:hint`,
  adminTestIds.topology.enable,
  `${adminTestIds.topology.hostService}:close-hint`,
])

const topologyHostErrorControls = Object.freeze([
  ...topologyLaptopBaseControls,
  adminTestIds.topology.pairResult,
  adminTestIds.topology.hostService,
  adminTestIds.topology.failureReason,
  adminTestIds.topology.alert,
  adminTestIds.topology.retry,
  adminTestIds.topology.action('return-choice'),
])

const topologyPairingControls = Object.freeze([
  ...topologyLaptopBaseControls,
  adminTestIds.topology.pairing,
  adminTestIds.topology.pairState,
  `${adminTestIds.topology.pairing}:facts`,
  adminTestIds.topology.hostIp,
  adminTestIds.topology.role,
  `${adminTestIds.topology.pairing}:hint`,
])

const topologyPairErrorControls = Object.freeze([
  ...topologyLaptopBaseControls,
  adminTestIds.topology.pairing,
  adminTestIds.topology.pairResult,
  adminTestIds.topology.hostIp,
  adminTestIds.topology.host,
  adminTestIds.topology.failureReason,
  adminTestIds.topology.alert,
  adminTestIds.topology.retry,
  adminTestIds.topology.action('return-choice'),
])

const topologyPairedControls = (includeHostService: boolean) => Object.freeze([
  ...topologyLaptopBaseControls,
  adminTestIds.topology.pairing,
  adminTestIds.topology.pairResult,
  `${adminTestIds.topology.pairing}:facts`,
  adminTestIds.topology.pairState,
  adminTestIds.topology.reachability,
  adminTestIds.topology.role,
  adminTestIds.topology.counterparty,
  `${adminTestIds.topology.pairing}:result`,
  ...(includeHostService ? [adminTestIds.topology.enable] : []),
  adminTestIds.topology.unpair,
])

type AdminFrameDefinitionInput = Readonly<{
  readonly id: AdminFrameId
  readonly name: string
  readonly renderer: AdminFrameRendererKey
  readonly fixture: AdminFrameFixtureKey
  readonly controlTestIDs: readonly string[]
  readonly variants?: readonly AdminFrameVariant[]
  readonly bindingKind?: AdminFrameBindingKind
}>

const definition = ({id, name, renderer, fixture, controlTestIDs, variants = [], bindingKind = 'production-renderer'}: AdminFrameDefinitionInput): AdminFrameDefinition => Object.freeze({
  id,
  name,
  renderer,
  bindingKind,
  fixture,
  rootTestID: frameTestId(id),
  controlTestIDs: Object.freeze([...controlTestIDs]),
  variants: Object.freeze([...variants]),
})

const variant = (id: string, controlTestIDs: readonly string[], mustNotTestIDs: readonly string[] = []): AdminFrameVariant => Object.freeze({
  id,
  controlTestIDs: Object.freeze([...controlTestIDs]),
  mustNotTestIDs: Object.freeze([...mustNotTestIDs]),
})

export const adminFrameDefinitions: readonly AdminFrameDefinition[] = Object.freeze([
  definition({id: 'IA-01', name: 'PANEL-L-NORMAL', renderer: 'AdminShellFrameLaptop', fixture: 'panel.laptop.normal', controlTestIDs: laptopPanelControls}),
  definition({id: 'IA-02', name: 'PANEL-M-NORMAL', renderer: 'AdminShellFrameMobile', fixture: 'panel.mobile.normal', controlTestIDs: mobilePanelControls}),
  definition({id: 'IA-03', name: 'PANEL-L-EMPTY', renderer: 'AdminPanelStateCardLaptop', fixture: 'panel.laptop.empty', controlTestIDs: [...laptopPanelControls, adminTestIds.panel.empty, `${adminTestIds.panel.empty}:reason`]}),
  definition({id: 'IA-04', name: 'PANEL-M-EMPTY', renderer: 'AdminPanelStateCardMobile', fixture: 'panel.mobile.empty', controlTestIDs: [...mobilePanelControls, adminTestIds.panel.empty, `${adminTestIds.panel.empty}:reason`]}),
  definition({id: 'IA-05', name: 'PANEL-L-LOADING', renderer: 'AdminPanelStateCardLaptop', fixture: 'panel.laptop.loading', controlTestIDs: [...laptopPanelControls, adminTestIds.panel.loading, `${adminTestIds.panel.loading}:content`, `${adminTestIds.panel.loading}:spinner`, `${adminTestIds.panel.loading}:skeleton`, `${adminTestIds.panel.loading}:message`]}),
  definition({id: 'IA-06', name: 'PANEL-M-LOADING', renderer: 'AdminPanelStateCardMobile', fixture: 'panel.mobile.loading', controlTestIDs: [...mobilePanelControls, adminTestIds.panel.loading, `${adminTestIds.panel.loading}:content`, `${adminTestIds.panel.loading}:spinner`, `${adminTestIds.panel.loading}:skeleton`, `${adminTestIds.panel.loading}:message`]}),
  definition({id: 'IA-07', name: 'PANEL-L-ERROR', renderer: 'AdminPanelStateCardLaptop', fixture: 'panel.laptop.error', controlTestIDs: [...laptopPanelControls, adminTestIds.panel.error, `${adminTestIds.panel.error}:content`, `${adminTestIds.panel.error}:reason`, adminTestIds.panel.retry]}),
  definition({id: 'IA-08', name: 'PANEL-M-ERROR', renderer: 'AdminPanelStateCardMobile', fixture: 'panel.mobile.error', controlTestIDs: [...mobilePanelControls, adminTestIds.panel.error, `${adminTestIds.panel.error}:content`, `${adminTestIds.panel.error}:reason`, adminTestIds.panel.retry]}),
  definition({id: 'IA-09', name: 'PORTS-L-OVERVIEW', renderer: 'PlatformPortsSectionLaptop', fixture: 'ports.laptop.overview', controlTestIDs: portsOverviewControls}),
  definition({id: 'IA-10', name: 'PORTS-M-OVERVIEW', renderer: 'PlatformPortsSectionMobile', fixture: 'ports.mobile.overview', controlTestIDs: portsMobileOverviewControls}),
  definition({id: 'IA-11', name: 'PORTS-L-CATEGORY-EXPANDED', renderer: 'PlatformPortsSectionLaptop', fixture: 'ports.laptop.category-expanded', controlTestIDs: [...portsOverviewControls, `${adminTestIds.ports.category('logs', 'row')}:content`, ...portsExpandedItemControls]}),
  definition({id: 'IA-12', name: 'PORTS-M-CATEGORY-EXPANDED', renderer: 'PlatformPortsSectionMobile', fixture: 'ports.mobile.category-expanded', controlTestIDs: [...portsMobileOverviewControls, `${adminTestIds.ports.category('logs', 'row')}:content`, ...portsExpandedItemControls]}),
  definition({id: 'IA-13', name: 'RUNTIME-L-SINGLE-SURFACE', renderer: 'RuntimeSectionLaptop', fixture: 'runtime.laptop.single-surface', controlTestIDs: runtimeLaptopControls}),
  definition({id: 'IA-14', name: 'RUNTIME-M-SINGLE-SURFACE', renderer: 'RuntimeSectionMobile', fixture: 'runtime.mobile.single-surface', controlTestIDs: runtimeMobileBaseControls, variants: [
    variant('single-surface', runtimeMobileReadyControls, [adminTestIds.runtime.displayFactsError]),
    variant('display-facts-error', runtimeMobileErrorControls, [adminTestIds.runtime.surfaceMap, adminTestIds.runtime.mobileSingleSurfaceBoundary]),
  ]}),
  definition({id: 'IA-15', name: 'RUNTIME-L-DUAL-SURFACE', renderer: 'RuntimeSectionLaptop', fixture: 'runtime.laptop.dual-surface', controlTestIDs: runtimeDualLaptopControls}),
  definition({id: 'IA-16', name: 'TOPOLOGY-L-UNAVAILABLE', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.unavailable', controlTestIDs: topologyUnavailableLaptopControls}),
  definition({id: 'IA-17', name: 'TOPOLOGY-M-UNAVAILABLE', renderer: 'TopologySectionMobile', fixture: 'topology.mobile.unavailable', controlTestIDs: topologyMobileControls}),
  definition({id: 'IA-18', name: 'TOPOLOGY-L-ROLE-CHOICE', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.role-choice', controlTestIDs: topologyRoleChoiceControls}),
  definition({id: 'IA-19', name: 'TOPOLOGY-L-HOST-STARTING', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.host-starting', controlTestIDs: topologyHostStartingControls}),
  definition({id: 'IA-20', name: 'TOPOLOGY-L-HOST-READY', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.host-ready', controlTestIDs: topologyHostReadyControls}),
  definition({id: 'IA-21', name: 'TOPOLOGY-L-HOST-ERROR', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.host-error', controlTestIDs: topologyHostErrorControls}),
  definition({id: 'IA-22', name: 'TOPOLOGY-L-PAIRING', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.pairing', controlTestIDs: topologyPairingControls}),
  definition({id: 'IA-23', name: 'TOPOLOGY-L-PAIR-ERROR', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.pair-error', controlTestIDs: topologyPairErrorControls}),
  definition({id: 'IA-24', name: 'TOPOLOGY-L-MASTER-PAIRED-REACHABLE', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.master-paired-reachable', controlTestIDs: topologyPairedControls(true)}),
  definition({id: 'IA-25', name: 'TOPOLOGY-L-MASTER-PAIRED-RECONNECTING', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.master-paired-reconnecting', controlTestIDs: topologyPairedControls(true)}),
  definition({id: 'IA-26', name: 'TOPOLOGY-L-UNPAIRING-MASTER', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.unpairing-master', controlTestIDs: topologyPairedControls(true)}),
  definition({id: 'IA-27', name: 'TOPOLOGY-L-SLAVE-PAIRED-REACHABLE', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.slave-paired-reachable', controlTestIDs: topologyPairedControls(false)}),
  definition({id: 'IA-28', name: 'TOPOLOGY-L-SLAVE-PAIRED-RECONNECTING', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.slave-paired-reconnecting', controlTestIDs: topologyPairedControls(false)}),
  definition({id: 'IA-29', name: 'TOPOLOGY-L-UNPAIRING-SLAVE', renderer: 'TopologySectionLaptop', fixture: 'topology.laptop.unpairing-slave', controlTestIDs: topologyPairedControls(false)}),
  definition({id: 'IA-32', name: 'CROSS-TAB-L-DUAL-PHYSICAL', renderer: 'CrossTabAudit', fixture: 'cross-tab.laptop.dual-physical', controlTestIDs: [...runtimeDualLaptopControls, adminTestIds.topology.pageGate, adminTestIds.topology.pageGateReason], bindingKind: 'artifact-only'}),
])

export const adminFrameIds: readonly AdminFrameId[] = Object.freeze(adminFrameDefinitions.map(frame => frame.id))

export const adminFrameRendererBindings: Readonly<Record<AdminFrameRendererKey, Readonly<{
  readonly source: string
  readonly stateSelector: string
  readonly bindingKind: AdminFrameBindingKind
}>>> = Object.freeze({
  AdminShellFrameLaptop: Object.freeze({source: 'src/components/AdminShellFrameLaptop.tsx', stateSelector: 'useAdminFrameController', bindingKind: 'production-renderer'}),
  AdminShellFrameMobile: Object.freeze({source: 'src/components/AdminShellFrameMobile.tsx', stateSelector: 'useAdminFrameController', bindingKind: 'production-renderer'}),
  AdminPanelStateCardLaptop: Object.freeze({source: 'src/components/AdminPanelStateCardLaptop.tsx', stateSelector: 'panelFrameId', bindingKind: 'production-renderer'}),
  AdminPanelStateCardMobile: Object.freeze({source: 'src/components/AdminPanelStateCardMobile.tsx', stateSelector: 'panelFrameId', bindingKind: 'production-renderer'}),
  PlatformPortsSectionLaptop: Object.freeze({source: 'src/components/sections/PlatformPortsSectionLaptop.tsx', stateSelector: 'portsFrameId', bindingKind: 'production-renderer'}),
  PlatformPortsSectionMobile: Object.freeze({source: 'src/components/sections/PlatformPortsSectionMobile.tsx', stateSelector: 'portsFrameId', bindingKind: 'production-renderer'}),
  RuntimeSectionLaptop: Object.freeze({source: 'src/components/sections/RuntimeSectionLaptop.tsx', stateSelector: 'runtimeFrameId', bindingKind: 'production-renderer'}),
  RuntimeSectionMobile: Object.freeze({source: 'src/components/sections/RuntimeSectionMobile.tsx', stateSelector: 'runtimeFrameId', bindingKind: 'production-renderer'}),
  TopologySectionLaptop: Object.freeze({source: 'src/components/sections/TopologySectionLaptop.tsx', stateSelector: 'topologyFrameId', bindingKind: 'production-renderer'}),
  TopologySectionMobile: Object.freeze({source: 'src/components/sections/TopologySectionMobile.tsx', stateSelector: 'topologyFrameId', bindingKind: 'production-renderer'}),
  CrossTabAudit: Object.freeze({source: 'cross-tab artifact', stateSelector: 'runtimeFrameId + topologyFrameId', bindingKind: 'artifact-only'}),
})

export const getAdminFrameDefinition = (id: AdminFrameId): AdminFrameDefinition => {
  const frame = adminFrameDefinitions.find(candidate => candidate.id === id)
  if (frame === undefined) throw new Error(`Unknown admin frame: ${id}`)
  return frame
}

export const getAdminFrameFixture = (id: AdminFrameId): AdminFrameFixture => adminFrameFixtures[getAdminFrameDefinition(id).fixture]

export const adminFrameTestId = (id: AdminFrameId): string => getAdminFrameDefinition(id).rootTestID

export type AdminFrameReporter = (frameId: AdminFrameId) => void

export const AdminFrameReporterContext = createContext<AdminFrameReporter | null>(null)

export const useReportAdminFrame = (frameId: AdminFrameId): void => {
  const report = useContext(AdminFrameReporterContext)
  useEffect(() => {
    report?.(frameId)
  }, [frameId, report])
}

export const useAdminFrameController = (defaultFrameId: AdminFrameId): Readonly<{
  readonly frameId: AdminFrameId
  readonly reportFrame: AdminFrameReporter
}> => {
  const [frameId, setFrameId] = useState<AdminFrameId>(defaultFrameId)
  useEffect(() => {
    setFrameId(defaultFrameId)
  }, [defaultFrameId])
  const reportFrame = useCallback<AdminFrameReporter>(nextFrameId => {
    setFrameId(nextFrameId)
  }, [])
  return {frameId, reportFrame}
}

export const panelFrameId = (surfaceForm: 'laptop' | 'mobile', state: 'normal' | 'empty' | 'loading' | 'error'): AdminFrameId => {
  const offset = surfaceForm === 'laptop' ? 0 : 1
  const stateIndex = state === 'normal' ? 1 : state === 'empty' ? 3 : state === 'loading' ? 5 : 7
  return `IA-${String(stateIndex + offset).padStart(2, '0')}` as AdminFrameId
}

export const portsFrameId = (surfaceForm: 'laptop' | 'mobile', expanded: boolean): AdminFrameId => {
  if (surfaceForm === 'laptop') return expanded ? 'IA-11' : 'IA-09'
  return expanded ? 'IA-12' : 'IA-10'
}

export const runtimeFrameId = (
  surfaceForm: 'laptop' | 'mobile',
  display: DisplayFactsReadModel | undefined,
): AdminFrameId => {
  if (surfaceForm === 'mobile') return 'IA-14'
  return display?.status === 'ready' && display.surfaces.length > 1 ? 'IA-15' : 'IA-13'
}

export type TopologyFrameInput = Readonly<{
  readonly surfaceForm: 'laptop' | 'mobile'
  readonly pageAvailable: boolean
  readonly facts: TopologyFacts | undefined
  readonly busy: TopologyOperation | null
  readonly feedbackTone: 'ok' | 'warn' | null
  readonly forceRoleChoice?: boolean
}>

export const topologyFrameId = (input: TopologyFrameInput): AdminFrameId => {
  if (!input.pageAvailable) return input.surfaceForm === 'mobile' ? 'IA-17' : 'IA-16'
  if (input.forceRoleChoice === true) return 'IA-18'
  const facts = input.facts
  if (input.busy === 'unpair') return facts?.instanceMode === 'SLAVE' ? 'IA-29' : 'IA-26'
  if (input.busy === 'pair') return 'IA-22'
  if (facts?.hostActual === 'error') return 'IA-21'
  if (input.feedbackTone === 'warn' && facts?.paired !== true) return 'IA-23'
  if (facts?.paired === true) {
    if (facts.instanceMode === 'SLAVE') return facts.peerReachable ? 'IA-27' : 'IA-28'
    return facts.peerReachable ? 'IA-24' : 'IA-25'
  }
  if (facts?.hostActual === 'starting' || facts?.hostActual === 'stopping' || input.busy === 'enable-host') return 'IA-19'
  if (facts?.hostActual === 'running') return 'IA-20'
  return 'IA-18'
}
