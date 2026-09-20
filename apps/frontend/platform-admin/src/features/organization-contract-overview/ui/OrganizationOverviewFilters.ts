import {LIFECYCLE_LABELS, NameCodeText} from '@catering-v2s/admin-ui-foundation';
import {createElement} from 'react';
import {extensionQueryValues} from './extensionList';
import type {
  OrganizationOverviewCategory,
  OrganizationOverviewSortDirection,
  OrganizationOverviewSortKey,
  OrganizationOverviewSource,
  OrganizationOverviewStatus,
  OrganizationOverviewType,
  ExtensionDefinition,
} from '../../../app/api/generated/platform-edge';

export type OrganizationTab = {
  key: string;
  label: string;
  category: OrganizationOverviewCategory;
  type?: OrganizationOverviewType;
};
export type OrganizationFilters = {
  name?: string;
  code?: string;
  legalName?: string;
  unifiedSocialCreditCode?: string;
  status?: OrganizationOverviewStatus;
  source?: OrganizationOverviewSource;
  projectId?: string;
  brandId?: string;
  tenantId?: string;
  headCompanyId?: string;
  extensionFilterValues?: Record<string, unknown>;
};
export type OrganizationFilterOption = {
  kind: 'PROJECT' | 'BRAND' | 'TENANT' | 'HEAD_COMPANY';
  id: string;
  code: string;
  name: string;
};
export type OrganizationTabQueryState = {
  filters: OrganizationFilters;
  sort: OrganizationOverviewSortKey;
  direction: OrganizationOverviewSortDirection;
};

export const organizationOverviewStatusValueEnum: Record<OrganizationOverviewStatus, {text: string}> = {
  ENABLED: {text: LIFECYCLE_LABELS.ENABLED},
  DISABLED: {text: LIFECYCLE_LABELS.DISABLED},
  VOIDED: {text: LIFECYCLE_LABELS.VOIDED},
};

export function organizationOverviewStatusLabel(value: OrganizationOverviewStatus): string {
  return organizationOverviewStatusValueEnum[value]?.text ?? '—';
}

export const defaultOrganizationTabQueryState: OrganizationTabQueryState = {
  filters: {},
  sort: 'UPDATED_AT',
  direction: 'DESC',
};

export function updateOrganizationTabQueryState(
  current: Record<string, OrganizationTabQueryState>,
  key: string,
  patch: Partial<OrganizationTabQueryState>,
): Record<string, OrganizationTabQueryState> {
  return {...current, [key]: {...(current[key] ?? defaultOrganizationTabQueryState), ...patch}};
}

/** The owner only permits reference candidates for STORE; retain no invalid ids across category changes. */
export function filtersForOrganizationTab(tab: OrganizationTab, current: OrganizationFilters): OrganizationFilters {
  const common = {
    name: current.name,
    code: current.code,
    status: current.status,
    source: current.source,
    extensionFilterValues: current.extensionFilterValues,
  };
  if (tab.category === 'STORE')
    return {
      ...common,
      projectId: current.projectId,
      brandId: current.brandId,
      tenantId: current.tenantId,
      headCompanyId: current.headCompanyId,
    };
  return tab.category === 'BUSINESS_ENTITY' && (tab.type === 'TENANT' || tab.type === 'HEAD_COMPANY')
    ? {...common, legalName: current.legalName, unifiedSocialCreditCode: current.unifiedSocialCreditCode}
    : common;
}

/** All selected owner-backed conditions are forwarded together to the generated request. */
export function organizationOverviewQuery(
  tab: OrganizationTab,
  current: OrganizationFilters,
  page: number,
  pageSize: number,
  sort: OrganizationOverviewSortKey,
  direction: OrganizationOverviewSortDirection,
  definition?: ExtensionDefinition,
) {
  const {extensionFilterValues, ...ownerFilters} = filtersForOrganizationTab(tab, current);
  return {
    category: tab.category,
    type: tab.type,
    ...ownerFilters,
    ...extensionQueryValues(definition, extensionFilterValues),
    sort,
    direction,
    page,
    pageSize,
  };
}

export function ownerFilterOptions(
  options: OrganizationFilterOption[] | undefined,
  kind: OrganizationFilterOption['kind'],
) {
  return (options ?? [])
    .filter(option => option.kind === kind)
    .map(option => ({value: option.id, label: createElement(NameCodeText, {name: option.name, code: option.code})}));
}
