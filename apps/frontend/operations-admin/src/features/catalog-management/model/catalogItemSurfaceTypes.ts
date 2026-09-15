import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import type {OperationsPageProps} from '../../../app/routing/model';

/** Shared surface contracts; fact presenters must not import the editor controller. */
export type CatalogItemDrawerProps = {
  itemCode?: string;
  initialMode?: 'view' | 'edit';
  initialViewTab?: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWriteCatalog: boolean;
  surface: 'store' | 'brand';
  onEdit?: () => void;
  onCopy?: (source: {itemCode: string; targetShapeKey?: string}) => void;
  onSaved?: () => void;
  onClose: () => void;
  onAfterOpenChange?: (visible: boolean) => void;
};

export type CatalogManifest = Pick<
  CatalogShapeManifestView,
  | 'shapeKeys'
  | 'enumLabels'
  | 'fields'
  | 'fieldRules'
  | 'tabRules'
  | 'typeEffects'
  | 'identifierRules'
  | 'preparationRules'
>;
