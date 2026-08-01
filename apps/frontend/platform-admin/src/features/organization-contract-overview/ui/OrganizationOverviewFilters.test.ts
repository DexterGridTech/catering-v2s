import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {filtersForOrganizationTab, organizationOverviewQuery, ownerFilterOptions, type OrganizationFilters, type OrganizationTab} from './OrganizationOverviewFilters';

const storeTab: OrganizationTab = {key: 'STORE', label: '门店', category: 'STORE', type: 'STORE'};
const brandTab: OrganizationTab = {key: 'BRAND', label: '品牌', category: 'BUSINESS_ENTITY', type: 'BRAND'};
const selected: OrganizationFilters = {name: '星', code: 'S', status: 'ENABLED', source: 'MANUAL', projectId: 'project-1', brandId: 'brand-1', tenantId: 'tenant-1'};

describe('organization overview owner-backed filters', () => {
  it('forwards every selected STORE condition into one generated-query argument', () => {
    expect(organizationOverviewQuery(storeTab, selected, 1, 20)).toEqual({category: 'STORE', type: 'STORE', ...selected, page: 1, pageSize: 20});
  });

  it('red mutation: dropping any selected owner filter from the query fails this exact assertion', () => {
    const query = organizationOverviewQuery(storeTab, selected, 1, 20);
    expect([query.source, query.projectId, query.brandId, query.tenantId]).toEqual(['MANUAL', 'project-1', 'brand-1', 'tenant-1']);
  });

  it('clears STORE-only references on a non-STORE tab but keeps common search conditions', () => {
    expect(filtersForOrganizationTab(brandTab, selected)).toEqual({name: '星', code: 'S', status: 'ENABLED', source: 'MANUAL'});
  });

  it('uses only owner-returned candidates and never infers ids from loaded rows', () => {
    expect(ownerFilterOptions([{kind: 'PROJECT', id: 'project-1', code: 'P1', name: '项目一'}, {kind: 'BRAND', id: 'brand-1', code: 'B1', name: '品牌一'}], 'PROJECT')).toEqual([{value: 'project-1', label: '项目一（P1）'}]);
  });

  it('binds the tested query and owner candidates to the generated-RTK page request', async () => {
    const page = await readFile(new URL('./PlatformReadPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain('query: organizationOverviewQuery(tab, organizationFilters, page, pageSize)');
    expect(page).toContain("ownerFilterOptions(organizationPage?.filterOptions, 'PROJECT')");
    expect(page).toContain("ownerFilterOptions(organizationPage?.filterOptions, 'BRAND')");
    expect(page).toContain("ownerFilterOptions(organizationPage?.filterOptions, 'TENANT')");
  });
});
