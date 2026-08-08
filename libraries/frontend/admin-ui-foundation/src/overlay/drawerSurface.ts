import type {DescriptionsProps, DrawerProps} from 'antd';

/**
 * The single mechanical Drawer surface contract shared by both admin faces.
 * Business owners still provide title, extra, footer content and lifecycle.
 */
export const adminDrawerSurfaceProps = {
  resizable: true,
  styles: {
    body: {overflowY: 'auto' as const, minHeight: 0},
    footer: {display: 'flex', justifyContent: 'flex-end', flexShrink: 0, position: 'sticky' as const, bottom: 0, zIndex: 1},
  },
} satisfies Pick<DrawerProps, 'resizable' | 'styles'>;

/** Approved wide surface for catalog/inventory detail and edit workflows. */
export const adminWideDrawerSurfaceProps = {
  ...adminDrawerSurfaceProps,
  width: 1024,
} satisfies Pick<DrawerProps, 'width' | 'resizable' | 'styles'>;

/** Shared compact single-column fact table for persistent admin detail Drawers. */
export const adminDetailDescriptionsProps = {
  bordered: true,
  size: 'small',
  column: 1,
  styles: {label: {width: 164}},
} satisfies Pick<DescriptionsProps, 'bordered' | 'size' | 'column' | 'styles'>;

/** Two-column variant for dense catalog/inventory read models in the wide Drawer. */
export const adminWideDetailDescriptionsProps = {
  bordered: true,
  size: 'small',
  column: 2,
  styles: {label: {width: 164}},
} satisfies Pick<DescriptionsProps, 'bordered' | 'size' | 'column' | 'styles'>;
