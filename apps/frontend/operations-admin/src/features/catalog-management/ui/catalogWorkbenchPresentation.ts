import type {Key, ReactNode} from 'react';

export type CatalogWorkbenchTreeNode = {
  key: Key;
  title: ReactNode;
  selectable?: boolean;
  children?: CatalogWorkbenchTreeNode[];
};

export type CatalogTreeSelection = {
  kind: 'SMART' | 'SHAPE' | 'CATEGORY' | 'TAG' | 'PRODUCTION_TAG' | 'UNCATEGORIZED';
  ref: string;
  label: string;
};
