import type {OrganizationOverviewCategory, OrganizationOverviewSource, OrganizationOverviewStatus, OrganizationOverviewType} from '../../../app/api/generated/platform-edge';

export type OrganizationTab = {key: string; label: string; category: OrganizationOverviewCategory; type?: OrganizationOverviewType};
export type OrganizationFilters = {name?: string; code?: string; status?: OrganizationOverviewStatus; source?: OrganizationOverviewSource; projectId?: string; brandId?: string; tenantId?: string};
export type OrganizationFilterOption = {kind: 'PROJECT' | 'BRAND' | 'TENANT'; id: string; code: string; name: string};

/** The owner only permits reference candidates for STORE; retain no invalid ids across category changes. */
export function filtersForOrganizationTab(tab: OrganizationTab, current: OrganizationFilters): OrganizationFilters {
  const common = {name: current.name, code: current.code, status: current.status, source: current.source};
  return tab.category === 'STORE' ? {...common, projectId: current.projectId, brandId: current.brandId, tenantId: current.tenantId} : common;
}

/** All selected owner-backed conditions are forwarded together to the generated request. */
export function organizationOverviewQuery(tab: OrganizationTab, current: OrganizationFilters, page: number, pageSize: number) {
  return {category: tab.category, type: tab.type, ...filtersForOrganizationTab(tab, current), page, pageSize};
}

export function ownerFilterOptions(options: OrganizationFilterOption[] | undefined, kind: OrganizationFilterOption['kind']) {
  return (options ?? []).filter((option) => option.kind === kind).map((option) => ({value: option.id, label: `${option.name}（${option.code}）`}));
}
