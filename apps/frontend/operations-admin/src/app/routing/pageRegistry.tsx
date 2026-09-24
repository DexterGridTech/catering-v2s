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
import {BrandCatalogManagementPage, StoreCatalogManagementPage} from '../../features/catalog-management';
import {InventoryManagementPage} from '../../features/inventory-management';
import {ProjectBusinessChannelPage} from '../../features/business-channel/ui/ProjectBusinessChannelPage';
import {StoreBusinessChannelPage} from '../../features/business-channel/ui/StoreBusinessChannelPage';
import {SalesMenuPage} from '../../features/sales-menu/ui/SalesMenuPage';
import {StoreServicePointPage} from '../../features/store-service-point/ui/StoreServicePointPage';
import {StoreTerminalPage} from '../../features/store-terminal/ui/StoreTerminalPage';

type Registration = {
  pageDesignKey: OperationsPageDesignKey;
  routeSegment: string;
  Component: ComponentType<OperationsPageProps>;
  legacyRouteMatcher?: (routeSegment: string) => boolean;
};
const user = (pageDesignKey: UserManagementPageDesignKey): ComponentType<OperationsPageProps> =>
  function UserPage(props) {
    return <WorkspaceUserPage {...props} pageDesignKey={pageDesignKey} />;
  };
const roleHome = (pageDesignKey: OperationsPageDesignKey): ComponentType<OperationsPageProps> =>
  function HomePage(props) {
    return <RoleHomeBootstrapPage {...props} pageDesignKey={pageDesignKey} />;
  };
const businessEntity = (
  pageDesignKey: Extract<
    OperationsPageDesignKey,
    | typeof operationsPageDesignKeys.PgOrgBrand
    | typeof operationsPageDesignKeys.PgOrgTenant
    | typeof operationsPageDesignKeys.PgOrgHeadCompany
  >,
): ComponentType<OperationsPageProps> =>
  function BusinessEntityPage(props) {
    return <BusinessEntityManagementPage {...props} pageDesignKey={pageDesignKey} />;
  };

const projectBusinessChannelPageKey = operationsPageDesignKeys.PgBusinessChannelProject;
const storeBusinessChannelPageKey = operationsPageDesignKeys.PgBusinessChannelStore;

const stableBusinessChannelRoute = (
  kind: 'projects' | 'stores',
  routeSegment: 'business-channels/project' | 'business-channels/store',
) => ({
  routeSegment,
  // Existing bookmarks may still contain a data-node UUID. Match it only to
  // migrate the page URL; the UUID is deliberately never returned as scope.
  legacyRouteMatcher: (candidate: string) =>
    new RegExp(
      `^${kind}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/business-channels$`,
    ).test(candidate),
});

export const operationsPageRegistry: Record<OperationsPageDesignKey, Registration> = {
  [operationsPageDesignKeys.HomeGroup]: {
    pageDesignKey: operationsPageDesignKeys.HomeGroup,
    routeSegment: 'home/group',
    Component: roleHome(operationsPageDesignKeys.HomeGroup),
  },
  [operationsPageDesignKeys.HomeRegion]: {
    pageDesignKey: operationsPageDesignKeys.HomeRegion,
    routeSegment: 'home/region',
    Component: roleHome(operationsPageDesignKeys.HomeRegion),
  },
  [operationsPageDesignKeys.HomeProject]: {
    pageDesignKey: operationsPageDesignKeys.HomeProject,
    routeSegment: 'home/project',
    Component: roleHome(operationsPageDesignKeys.HomeProject),
  },
  [operationsPageDesignKeys.HomeHeadCompany]: {
    pageDesignKey: operationsPageDesignKeys.HomeHeadCompany,
    routeSegment: 'home/head-company',
    Component: roleHome(operationsPageDesignKeys.HomeHeadCompany),
  },
  [operationsPageDesignKeys.HomeStore]: {
    pageDesignKey: operationsPageDesignKeys.HomeStore,
    routeSegment: 'home/store',
    Component: roleHome(operationsPageDesignKeys.HomeStore),
  },
  [operationsPageDesignKeys.PgOrgStructure]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgStructure,
    routeSegment: 'organization/structure',
    Component: OrganizationStructurePage,
  },
  [operationsPageDesignKeys.PgOrgBrand]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgBrand,
    routeSegment: 'organization/brands',
    Component: businessEntity(operationsPageDesignKeys.PgOrgBrand),
  },
  [operationsPageDesignKeys.PgOrgTenant]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgTenant,
    routeSegment: 'organization/tenants',
    Component: businessEntity(operationsPageDesignKeys.PgOrgTenant),
  },
  [operationsPageDesignKeys.PgOrgHeadCompany]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgHeadCompany,
    routeSegment: 'organization/head-companies',
    Component: businessEntity(operationsPageDesignKeys.PgOrgHeadCompany),
  },
  [operationsPageDesignKeys.PgOrgStoreManage]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgStoreManage,
    routeSegment: 'organization/stores',
    Component: StoreManagementPage,
  },
  [operationsPageDesignKeys.PgContractStoreManage]: {
    pageDesignKey: operationsPageDesignKeys.PgContractStoreManage,
    routeSegment: 'contracts',
    Component: ContractManagementPage,
  },
  [operationsPageDesignKeys.PgIamGroupUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamGroupUsers,
    routeSegment: 'access/group-users',
    Component: user(operationsPageDesignKeys.PgIamGroupUsers),
  },
  [operationsPageDesignKeys.PgIamRegionUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamRegionUsers,
    routeSegment: 'access/region-users',
    Component: user(operationsPageDesignKeys.PgIamRegionUsers),
  },
  [operationsPageDesignKeys.PgIamProjectUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamProjectUsers,
    routeSegment: 'access/project-users',
    Component: user(operationsPageDesignKeys.PgIamProjectUsers),
  },
  [operationsPageDesignKeys.PgIamHeadCompanyUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamHeadCompanyUsers,
    routeSegment: 'access/head-company-users',
    Component: user(operationsPageDesignKeys.PgIamHeadCompanyUsers),
  },
  [operationsPageDesignKeys.PgIamStoreUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamStoreUsers,
    routeSegment: 'access/store-users',
    Component: user(operationsPageDesignKeys.PgIamStoreUsers),
  },
  [operationsPageDesignKeys.PgStoreProfile]: {
    pageDesignKey: operationsPageDesignKeys.PgStoreProfile,
    routeSegment: 'store/profile',
    Component: StoreProfilePage,
  },
  [projectBusinessChannelPageKey]: {
    pageDesignKey: projectBusinessChannelPageKey,
    ...stableBusinessChannelRoute('projects', 'business-channels/project'),
    Component: ProjectBusinessChannelPage,
  },
  [storeBusinessChannelPageKey]: {
    pageDesignKey: storeBusinessChannelPageKey,
    ...stableBusinessChannelRoute('stores', 'business-channels/store'),
    Component: StoreBusinessChannelPage,
  },
  [operationsPageDesignKeys.PgCatalogStoreItems]: {
    pageDesignKey: operationsPageDesignKeys.PgCatalogStoreItems,
    routeSegment: 'catalog/store-items',
    Component: StoreCatalogManagementPage,
  },
  [operationsPageDesignKeys.PgInventoryStoreStatus]: {
    pageDesignKey: operationsPageDesignKeys.PgInventoryStoreStatus,
    routeSegment: 'inventory/status',
    Component: InventoryManagementPage,
  },
  [operationsPageDesignKeys.PgCatalogBrandItems]: {
    pageDesignKey: operationsPageDesignKeys.PgCatalogBrandItems,
    routeSegment: 'catalog/brand-items',
    Component: BrandCatalogManagementPage,
  },
  [operationsPageDesignKeys.PgSalesMenuStore]: {
    pageDesignKey: operationsPageDesignKeys.PgSalesMenuStore,
    routeSegment: 'catalog/sales-menus',
    Component: SalesMenuPage,
  },
  [operationsPageDesignKeys.PgStoreServicePointQr]: {
    pageDesignKey: operationsPageDesignKeys.PgStoreServicePointQr,
    routeSegment: 'organization/store-service-points',
    Component: StoreServicePointPage,
  },
  [operationsPageDesignKeys.PgStoreTerminals]: {
    pageDesignKey: operationsPageDesignKeys.PgStoreTerminals,
    routeSegment: 'organization/store-terminals',
    Component: StoreTerminalPage,
  },
} satisfies Record<OperationsPageDesignKey, Registration>;

const approvedKeys = new Set<string>(adminCatalog.operationsPages.map(page => page.pageDesignKey));
export function parseOperationsPageDesignKey(value: string | undefined): OperationsPageDesignKey | undefined {
  return value && approvedKeys.has(value) ? (value as OperationsPageDesignKey) : undefined;
}

export function matchOperationsRoute(routeSegment: string) {
  for (const [key, registration] of Object.entries(operationsPageRegistry)) {
    if (registration.routeSegment === routeSegment) return {key: key as OperationsPageDesignKey, canonical: true};
    if (registration.legacyRouteMatcher?.(routeSegment)) return {key: key as OperationsPageDesignKey, canonical: false};
  }
  return undefined;
}

export function routeForOperationsPage(pageKey: OperationsPageDesignKey) {
  const registration = operationsPageRegistry[pageKey];
  return registration.routeSegment;
}
