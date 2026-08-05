import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {defaultOrganizationTabQueryState, filtersForOrganizationTab, organizationOverviewQuery, ownerFilterOptions, updateOrganizationTabQueryState, type OrganizationFilters, type OrganizationTab} from './OrganizationOverviewFilters';

const storeTab: OrganizationTab = {key: 'STORE', label: '门店', category: 'STORE', type: 'STORE'};
const brandTab: OrganizationTab = {key: 'BRAND', label: '品牌', category: 'BUSINESS_ENTITY', type: 'BRAND'};
const tenantTab: OrganizationTab = {key: 'TENANT', label: '经营租户', category: 'BUSINESS_ENTITY', type: 'TENANT'};
const selected: OrganizationFilters = {name: '星', code: 'S', legalName: '法人', unifiedSocialCreditCode: '9131', status: 'ENABLED', source: 'MANUAL', projectId: 'project-1', brandId: 'brand-1', tenantId: 'tenant-1', headCompanyId: 'head-company-1'};

describe('organization overview owner-backed filters', () => {
  it('forwards every selected STORE condition into one generated-query argument', () => {
    expect(organizationOverviewQuery(storeTab, selected, 1, 10, 'NAME', 'ASC')).toEqual({category: 'STORE', type: 'STORE', name: '星', code: 'S', status: 'ENABLED', source: 'MANUAL', projectId: 'project-1', brandId: 'brand-1', tenantId: 'tenant-1', headCompanyId: 'head-company-1', sort: 'NAME', direction: 'ASC', page: 1, pageSize: 10});
  });

  it('red mutation: dropping any selected owner filter from the query fails this exact assertion', () => {
    const query = organizationOverviewQuery(storeTab, selected, 1, 20, 'CODE', 'DESC');
    expect([query.source, query.projectId, query.brandId, query.tenantId, query.headCompanyId, query.sort, query.direction]).toEqual(['MANUAL', 'project-1', 'brand-1', 'tenant-1', 'head-company-1', 'CODE', 'DESC']);
  });

  it('clears STORE-only references on a non-STORE tab but keeps common search conditions', () => {
    expect(filtersForOrganizationTab(brandTab, selected)).toEqual({name: '星', code: 'S', status: 'ENABLED', source: 'MANUAL'});
    expect(filtersForOrganizationTab(tenantTab, selected)).toEqual({name: '星', code: 'S', legalName: '法人', unifiedSocialCreditCode: '9131', status: 'ENABLED', source: 'MANUAL'});
  });

  it('uses only owner-returned candidates and never infers ids from loaded rows', () => {
    expect(ownerFilterOptions([{kind: 'PROJECT', id: 'project-1', code: 'P1', name: '项目一'}, {kind: 'BRAND', id: 'brand-1', code: 'B1', name: '品牌一'}, {kind: 'HEAD_COMPANY', id: 'head-company-1', code: 'HC1', name: '总公司一'}], 'HEAD_COMPANY')).toEqual([{value: 'head-company-1', label: '总公司一(HC1)'}]);
  });

  it('keeps each organization tab query state independent', () => {
    const states = updateOrganizationTabQueryState({BRAND: defaultOrganizationTabQueryState}, 'TENANT', {filters: {name: '租户'}});
    expect(states.BRAND).toEqual(defaultOrganizationTabQueryState);
    expect(states.TENANT.filters).toEqual({name: '租户'});
  });

  it('binds the tested query and owner candidates to the generated-RTK page request', async () => {
    const page = await readFile(new URL('./PlatformReadPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('organizationOverviewQuery(tab, organizationTabState.filters, organizationTabState.page, organizationTabState.pageSize, organizationTabState.sort, organizationTabState.direction)');
    expect(page).toContain("ownerFilterOptions(organizationPage?.filterOptions, 'PROJECT')");
    expect(page).toContain("ownerFilterOptions(organizationPage?.filterOptions, 'BRAND')");
    expect(page).toContain("ownerFilterOptions(organizationPage?.filterOptions, 'TENANT')");
    expect(page).toContain("ownerFilterOptions(organizationPage?.filterOptions, 'HEAD_COMPANY')");
  });
});
