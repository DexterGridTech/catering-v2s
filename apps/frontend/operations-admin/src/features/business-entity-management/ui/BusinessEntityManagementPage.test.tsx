import fs from 'node:fs';
import {describe, expect, it} from 'vitest';

const page = fs.readFileSync(new URL('./BusinessEntityManagementPage.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('./BusinessEntityDetailDrawer.tsx', import.meta.url), 'utf8');
const create = fs.readFileSync(new URL('./BusinessEntityCreateDrawer.tsx', import.meta.url), 'utf8');
const edit = fs.readFileSync(new URL('./BusinessEntityEditDrawer.tsx', import.meta.url), 'utf8');
const status = fs.readFileSync(new URL('./BusinessEntityStatusModal.tsx', import.meta.url), 'utf8');

describe('BusinessEntityManagementPage', () => {
  it('keeps three fixed page-key workflows owner-paged with no operation column', () => {
    expect(page).toMatch(/PgOrgBrand/);
    expect(page).toMatch(/PgOrgTenant/);
    expect(page).toMatch(/PgOrgHeadCompany/);
    expect(page).toMatch(/contextScopedQueryArgs/);
    expect(page).toMatch(/useGetOperationsOrganizationBrandsQuery/);
    expect(page).toMatch(/useGetOperationsOrganizationTenantsQuery/);
    expect(page).toMatch(/useGetOperationsOrganizationHeadCompaniesQuery/);
    expect(page).toMatch(/useState<BusinessEntitySortKey>\('NAME'\)/);
    expect(page).toMatch(/useState<BusinessEntitySortDirection>\('ASC'\)/);
    expect(page).toMatch(/sort,\s*direction,\s*page/);
    expect(page).toMatch(/key: 'name'.*sorter: true/);
    expect(page).toMatch(/key: 'updatedAt'.*sorter: true/);
    expect(page).toMatch(/current\?\.columnKey === 'name' \? 'NAME'/);
    expect(page).toMatch(/current\?\.columnKey === 'code' \? 'CODE' : 'UPDATED_AT'/);
    expect(page).not.toMatch(/valueType:\s*['"]option/);
    expect(page).not.toMatch(/title:\s*['"]操作/);
  });

  it('uses physical detail/create/edit/status surfaces and owner-safe write readback', () => {
    expect(page).toMatch(/BusinessEntityDetailDrawer/);
    expect(page).toMatch(/BusinessEntityCreateDrawer/);
    expect(page).toMatch(/BusinessEntityEditDrawer/);
    expect(page).toMatch(/BusinessEntityStatusModal/);
    expect(detail).toMatch(/useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery/);
    expect(detail).toMatch(/detailReady = Boolean\(selected\)/);
    expect(detail).toMatch(/extra=\{detailReady && selected/);
    expect(detail).toContain('size="small" column={1} styles={{label: {width: 164}}}');
    expect(detail).toMatch(/if \(!detailReady \|\| !selected\) return/);
    expect(create).toMatch(/useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery/);
    expect(edit).toMatch(/useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery/);
    expect(status).toMatch(/useSubmissionLifecycle/);
    expect(create + edit).not.toMatch(/operationsProblemOf\(error\)\.detail/);
  });
});
