import type {ReactNode} from 'react';
import {
  adminCatalog,
  platformPageDesignKeys,
  type PlatformPageDesignKey,
} from '../catalog/generatedAdminCatalog';
import {WorkspaceManagementPage} from '../../features/workspace-management/ui/WorkspaceManagementPage';
import {WorkspaceAdministrationPage} from '../../features/workspace-administration/ui/WorkspaceAdministrationPage';
import {AdministratorsPage} from '../../features/platform-administration/ui/AdministratorsPage';
import {RolesPage} from '../../features/workspace-iam/ui/RolesPage';
import {AccountsPage} from '../../features/workspace-iam/ui/AccountsPage';
import {PlatformReadPage} from '../../features/organization-contract-overview/ui/PlatformReadPage';
import {ExtensionsPage} from '../../features/extension-management/ui/ExtensionsPage';

type RouteRegistration = {path: string; element: ReactNode};
const routeByPageDesignKey = {
  [platformPageDesignKeys.PlatformWorkspaces]: {path: '/platform/workspaces', element: <WorkspaceManagementPage/>},
  [platformPageDesignKeys.PlatformAdminUsers]: {path: '/platform/admin-users', element: <AdministratorsPage/>},
  [platformPageDesignKeys.PlatformWorkspaceOverview]: {path: '/platform/workspace-overview', element: <WorkspaceAdministrationPage/>},
  [platformPageDesignKeys.PlatformOrganizationOverview]: {path: '/platform/organization-overview', element: <PlatformReadPage kind="organization"/>},
  [platformPageDesignKeys.PlatformContractOverview]: {path: '/platform/contract-overview', element: <PlatformReadPage kind="contracts"/>},
  [platformPageDesignKeys.PlatformRoles]: {path: '/platform/roles', element: <RolesPage/>},
  [platformPageDesignKeys.PlatformWorkspaceAccounts]: {path: '/platform/workspace-accounts', element: <AccountsPage/>},
  [platformPageDesignKeys.PlatformExtensionFields]: {path: '/platform/extension-fields', element: <ExtensionsPage/>},
} satisfies Record<PlatformPageDesignKey, RouteRegistration>;

const platformPagesInCatalogOrder = adminCatalog.platformPages.map((page) => page).sort((left, right) => left.menuOrder - right.menuOrder);

export const platformPageRegistry = Object.fromEntries(platformPagesInCatalogOrder.map((page) => {
  const pageDesignKey = page.pageDesignKey as PlatformPageDesignKey;
  const route = routeByPageDesignKey[pageDesignKey];
  if (!route) throw new Error(`Missing platform route registration: ${pageDesignKey}`);
  return [pageDesignKey, {...route, pageDesignKey, title: page.title, iconKey: page.iconKey, menuOrder: page.menuOrder, workspaceRequirement: page.workspaceRequirement}];
})) as Record<PlatformPageDesignKey, RouteRegistration & {pageDesignKey: PlatformPageDesignKey; title: string; iconKey: string; menuOrder: number; workspaceRequirement: string}>;
