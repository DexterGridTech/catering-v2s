import type {ComponentType} from 'react';
import {
  adminCatalog,
  operationsPageDesignKeys,
  type OperationsPageDesignKey,
  type UserManagementPageDesignKey,
} from '../catalog/generatedAdminCatalog';
import type {OperationsPageProps} from './model';
import {OrganizationStructurePage} from '../../features/organization-structure/ui/OrganizationStructurePage';
import {BusinessEntityManagementPage} from '../../features/business-entity-management/ui/BusinessEntityManagementPage';
import {StoreManagementPage} from '../../features/store-management/ui/StoreManagementPage';
import {ContractManagementPage} from '../../features/contract-management/ui/ContractManagementPage';
import {WorkspaceUserPage} from '../../features/workspace-user/ui/WorkspaceUserPage';
import {RoleHomeBootstrapPage} from '../../features/role-home-bootstrap/ui/RoleHomeBootstrapPage';
import {StoreProfilePage} from '../../features/store-profile/ui/StoreProfilePage';

type Registration = {
  pageDesignKey: OperationsPageDesignKey;
  routeSegment: string;
  Component: ComponentType<OperationsPageProps>;
};
const user = (pageDesignKey: UserManagementPageDesignKey): ComponentType<OperationsPageProps> =>
  function UserPage(props) {
    return <WorkspaceUserPage {...props} pageDesignKey={pageDesignKey}/>;
  };
const roleHome = (pageDesignKey: OperationsPageDesignKey): ComponentType<OperationsPageProps> =>
  function HomePage(props) {
    return <RoleHomeBootstrapPage {...props} pageDesignKey={pageDesignKey}/>;
  };
const businessEntity = (pageDesignKey: Extract<OperationsPageDesignKey,
  typeof operationsPageDesignKeys.PgOrgBrand | typeof operationsPageDesignKeys.PgOrgTenant | typeof operationsPageDesignKeys.PgOrgHeadCompany>): ComponentType<OperationsPageProps> =>
  function BusinessEntityPage(props) {
    return <BusinessEntityManagementPage {...props} pageDesignKey={pageDesignKey}/>;
  };

export const operationsPageRegistry = {
  [operationsPageDesignKeys.HomeGroup]: {pageDesignKey: operationsPageDesignKeys.HomeGroup, routeSegment: 'home/group', Component: roleHome(operationsPageDesignKeys.HomeGroup)},
  [operationsPageDesignKeys.HomeRegion]: {pageDesignKey: operationsPageDesignKeys.HomeRegion, routeSegment: 'home/region', Component: roleHome(operationsPageDesignKeys.HomeRegion)},
  [operationsPageDesignKeys.HomeProject]: {pageDesignKey: operationsPageDesignKeys.HomeProject, routeSegment: 'home/project', Component: roleHome(operationsPageDesignKeys.HomeProject)},
  [operationsPageDesignKeys.HomeHeadCompany]: {pageDesignKey: operationsPageDesignKeys.HomeHeadCompany, routeSegment: 'home/head-company', Component: roleHome(operationsPageDesignKeys.HomeHeadCompany)},
  [operationsPageDesignKeys.HomeStore]: {pageDesignKey: operationsPageDesignKeys.HomeStore, routeSegment: 'home/store', Component: roleHome(operationsPageDesignKeys.HomeStore)},
  [operationsPageDesignKeys.PgOrgStructure]: {pageDesignKey: operationsPageDesignKeys.PgOrgStructure, routeSegment: 'organization/structure', Component: OrganizationStructurePage},
  [operationsPageDesignKeys.PgOrgBrand]: {pageDesignKey: operationsPageDesignKeys.PgOrgBrand, routeSegment: 'organization/brands', Component: businessEntity(operationsPageDesignKeys.PgOrgBrand)},
  [operationsPageDesignKeys.PgOrgTenant]: {pageDesignKey: operationsPageDesignKeys.PgOrgTenant, routeSegment: 'organization/tenants', Component: businessEntity(operationsPageDesignKeys.PgOrgTenant)},
  [operationsPageDesignKeys.PgOrgHeadCompany]: {pageDesignKey: operationsPageDesignKeys.PgOrgHeadCompany, routeSegment: 'organization/head-companies', Component: businessEntity(operationsPageDesignKeys.PgOrgHeadCompany)},
  [operationsPageDesignKeys.PgOrgStoreManage]: {pageDesignKey: operationsPageDesignKeys.PgOrgStoreManage, routeSegment: 'organization/stores', Component: StoreManagementPage},
  [operationsPageDesignKeys.PgContractStoreManage]: {pageDesignKey: operationsPageDesignKeys.PgContractStoreManage, routeSegment: 'contracts', Component: ContractManagementPage},
  [operationsPageDesignKeys.PgIamGroupUsers]: {pageDesignKey: operationsPageDesignKeys.PgIamGroupUsers, routeSegment: 'access/group-users', Component: user(operationsPageDesignKeys.PgIamGroupUsers)},
  [operationsPageDesignKeys.PgIamRegionUsers]: {pageDesignKey: operationsPageDesignKeys.PgIamRegionUsers, routeSegment: 'access/region-users', Component: user(operationsPageDesignKeys.PgIamRegionUsers)},
  [operationsPageDesignKeys.PgIamProjectUsers]: {pageDesignKey: operationsPageDesignKeys.PgIamProjectUsers, routeSegment: 'access/project-users', Component: user(operationsPageDesignKeys.PgIamProjectUsers)},
  [operationsPageDesignKeys.PgIamHeadCompanyUsers]: {pageDesignKey: operationsPageDesignKeys.PgIamHeadCompanyUsers, routeSegment: 'access/head-company-users', Component: user(operationsPageDesignKeys.PgIamHeadCompanyUsers)},
  [operationsPageDesignKeys.PgIamStoreUsers]: {pageDesignKey: operationsPageDesignKeys.PgIamStoreUsers, routeSegment: 'access/store-users', Component: user(operationsPageDesignKeys.PgIamStoreUsers)},
  [operationsPageDesignKeys.PgStoreProfile]: {pageDesignKey: operationsPageDesignKeys.PgStoreProfile, routeSegment: 'store/profile', Component: StoreProfilePage},
} satisfies Record<OperationsPageDesignKey, Registration>;

const approvedKeys = new Set<string>(adminCatalog.operationsPages.map((page) => page.pageDesignKey));
export function parseOperationsPageDesignKey(value: string | undefined): OperationsPageDesignKey | undefined {
  return value && approvedKeys.has(value) ? value as OperationsPageDesignKey : undefined;
}
