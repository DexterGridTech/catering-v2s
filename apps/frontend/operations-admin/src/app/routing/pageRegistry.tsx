import {
  ApartmentOutlined,
  BankOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileTextOutlined,
  ReloadOutlined,
  ShopOutlined,
  TagsOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type {ComponentType, ReactNode} from 'react';
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
import {ProjectTerminalUpdatePage} from '../../features/terminal-update/ui/ProjectTerminalUpdatePage';

type Registration = {
  pageDesignKey: OperationsPageDesignKey;
  routeSegment: string;
  Component: ComponentType<OperationsPageProps>;
  icon: ReactNode;
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
    icon: <DashboardOutlined />,
  },
  [operationsPageDesignKeys.HomeRegion]: {
    pageDesignKey: operationsPageDesignKeys.HomeRegion,
    routeSegment: 'home/region',
    Component: roleHome(operationsPageDesignKeys.HomeRegion),
    icon: <DashboardOutlined />,
  },
  [operationsPageDesignKeys.HomeProject]: {
    pageDesignKey: operationsPageDesignKeys.HomeProject,
    routeSegment: 'home/project',
    Component: roleHome(operationsPageDesignKeys.HomeProject),
    icon: <DashboardOutlined />,
  },
  [operationsPageDesignKeys.HomeHeadCompany]: {
    pageDesignKey: operationsPageDesignKeys.HomeHeadCompany,
    routeSegment: 'home/head-company',
    Component: roleHome(operationsPageDesignKeys.HomeHeadCompany),
    icon: <DashboardOutlined />,
  },
  [operationsPageDesignKeys.HomeStore]: {
    pageDesignKey: operationsPageDesignKeys.HomeStore,
    routeSegment: 'home/store',
    Component: roleHome(operationsPageDesignKeys.HomeStore),
    icon: <DashboardOutlined />,
  },
  [operationsPageDesignKeys.PgOrgStructure]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgStructure,
    routeSegment: 'organization/structure',
    Component: OrganizationStructurePage,
    icon: <ApartmentOutlined />,
  },
  [operationsPageDesignKeys.PgOrgBrand]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgBrand,
    routeSegment: 'organization/brands',
    Component: businessEntity(operationsPageDesignKeys.PgOrgBrand),
    icon: <TagsOutlined />,
  },
  [operationsPageDesignKeys.PgOrgTenant]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgTenant,
    routeSegment: 'organization/tenants',
    Component: businessEntity(operationsPageDesignKeys.PgOrgTenant),
    icon: <BankOutlined />,
  },
  [operationsPageDesignKeys.PgOrgHeadCompany]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgHeadCompany,
    routeSegment: 'organization/head-companies',
    Component: businessEntity(operationsPageDesignKeys.PgOrgHeadCompany),
    icon: <ClusterOutlined />,
  },
  [operationsPageDesignKeys.PgOrgStoreManage]: {
    pageDesignKey: operationsPageDesignKeys.PgOrgStoreManage,
    routeSegment: 'organization/stores',
    Component: StoreManagementPage,
    icon: <ShopOutlined />,
  },
  [operationsPageDesignKeys.PgContractStoreManage]: {
    pageDesignKey: operationsPageDesignKeys.PgContractStoreManage,
    routeSegment: 'contracts',
    Component: ContractManagementPage,
    icon: <FileTextOutlined />,
  },
  [operationsPageDesignKeys.PgIamGroupUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamGroupUsers,
    routeSegment: 'access/group-users',
    Component: user(operationsPageDesignKeys.PgIamGroupUsers),
    icon: <TeamOutlined />,
  },
  [operationsPageDesignKeys.PgIamRegionUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamRegionUsers,
    routeSegment: 'access/region-users',
    Component: user(operationsPageDesignKeys.PgIamRegionUsers),
    icon: <TeamOutlined />,
  },
  [operationsPageDesignKeys.PgIamProjectUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamProjectUsers,
    routeSegment: 'access/project-users',
    Component: user(operationsPageDesignKeys.PgIamProjectUsers),
    icon: <TeamOutlined />,
  },
  [operationsPageDesignKeys.PgIamHeadCompanyUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamHeadCompanyUsers,
    routeSegment: 'access/head-company-users',
    Component: user(operationsPageDesignKeys.PgIamHeadCompanyUsers),
    icon: <TeamOutlined />,
  },
  [operationsPageDesignKeys.PgIamStoreUsers]: {
    pageDesignKey: operationsPageDesignKeys.PgIamStoreUsers,
    routeSegment: 'access/store-users',
    Component: user(operationsPageDesignKeys.PgIamStoreUsers),
    icon: <TeamOutlined />,
  },
  [operationsPageDesignKeys.PgStoreProfile]: {
    pageDesignKey: operationsPageDesignKeys.PgStoreProfile,
    routeSegment: 'store/profile',
    Component: StoreProfilePage,
    icon: <ShopOutlined />,
  },
  [projectBusinessChannelPageKey]: {
    pageDesignKey: projectBusinessChannelPageKey,
    ...stableBusinessChannelRoute('projects', 'business-channels/project'),
    Component: ProjectBusinessChannelPage,
    icon: <ShopOutlined />,
  },
  [storeBusinessChannelPageKey]: {
    pageDesignKey: storeBusinessChannelPageKey,
    ...stableBusinessChannelRoute('stores', 'business-channels/store'),
    Component: StoreBusinessChannelPage,
    icon: <ShopOutlined />,
  },
  [operationsPageDesignKeys.PgCatalogStoreItems]: {
    pageDesignKey: operationsPageDesignKeys.PgCatalogStoreItems,
    routeSegment: 'catalog/store-items',
    Component: StoreCatalogManagementPage,
    icon: <TagsOutlined />,
  },
  [operationsPageDesignKeys.PgInventoryStoreStatus]: {
    pageDesignKey: operationsPageDesignKeys.PgInventoryStoreStatus,
    routeSegment: 'inventory/status',
    Component: InventoryManagementPage,
    icon: <ShopOutlined />,
  },
  [operationsPageDesignKeys.PgCatalogBrandItems]: {
    pageDesignKey: operationsPageDesignKeys.PgCatalogBrandItems,
    routeSegment: 'catalog/brand-items',
    Component: BrandCatalogManagementPage,
    icon: <TagsOutlined />,
  },
  [operationsPageDesignKeys.PgSalesMenuStore]: {
    pageDesignKey: operationsPageDesignKeys.PgSalesMenuStore,
    routeSegment: 'catalog/sales-menus',
    Component: SalesMenuPage,
    icon: <TagsOutlined />,
  },
  [operationsPageDesignKeys.PgStoreServicePointQr]: {
    pageDesignKey: operationsPageDesignKeys.PgStoreServicePointQr,
    routeSegment: 'organization/store-service-points',
    Component: StoreServicePointPage,
    icon: <ShopOutlined />,
  },
  [operationsPageDesignKeys.PgStoreTerminals]: {
    pageDesignKey: operationsPageDesignKeys.PgStoreTerminals,
    routeSegment: 'organization/store-terminals',
    Component: StoreTerminalPage,
    icon: <ShopOutlined />,
  },
  [operationsPageDesignKeys.PgProjectTerminalVersionRules]: {
    pageDesignKey: operationsPageDesignKeys.PgProjectTerminalVersionRules,
    routeSegment: 'terminal-update/rules',
    Component: ProjectTerminalUpdatePage,
    icon: <ReloadOutlined />,
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
