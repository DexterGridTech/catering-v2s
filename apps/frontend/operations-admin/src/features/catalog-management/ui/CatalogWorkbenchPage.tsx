import type {OperationsPageProps} from '../../../app/routing/model';
import {CatalogWorkbenchWorkspace} from './CatalogWorkbenchWorkspace';

/**
 * Route host only: the workbench owns all catalog state through its bounded
 * feature surfaces. Store and brand stay the two explicit entry points.
 */
export function StoreCatalogManagementPage(props: OperationsPageProps) {
  return <CatalogWorkbenchWorkspace {...props} surface="store" />;
}

export function BrandCatalogManagementPage(props: OperationsPageProps) {
  return <CatalogWorkbenchWorkspace {...props} surface="brand" />;
}
