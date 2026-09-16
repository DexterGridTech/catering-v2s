/**
 * Public catalog-management surface for other operations-admin features.
 * Consumers use this entrypoint instead of reaching into catalog-management's
 * private UI directory, while the drawer implementation remains owned by the
 * catalog feature.
 */
export {CatalogItemDrawer} from './ui/CatalogItemDrawer';
export type {CatalogItemDrawerProps} from './model/catalogItemSurfaceTypes';
