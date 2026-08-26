import type {Form} from 'antd';
import type {OperationsPageProps} from '../../../app/routing/model';
import type {
  CatalogAttributeAssignment,
  CatalogDetail,
  CatalogInventoryRuleNode,
  CatalogOrderOptionConfig,
  CatalogSkuRow,
} from '../model/catalogModel';
import type {
  CatalogCompositeGroupDraft,
  CatalogEditorDraftSlice,
  CatalogItemBasicDraft,
  CatalogIdentifierDraft,
  CatalogItemProductionDraft,
  MediaDraft,
  SkuDimensionDraft,
  SkuRowDraft,
} from '../model/catalogItemEditorDraftAdapters';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import type {CatalogLibraryKind} from '../model/catalogWorkspaceTask';

/** Typed cross-section assembly contract. Each fact-family editor receives only
 * its own slice and callbacks; the surface host never serializes that slice. */
export type CatalogItemEditorSectionProps = {
  tabKey: string;
  detail: NonNullable<CatalogDetail>;
  manifest?: CatalogManifest;
  canWriteCatalog: boolean;
  form: ReturnType<typeof Form.useForm<{displayName: string; shortName?: string}>>[0];
  mediaDraft: MediaDraft[];
  onStageMedia: (file: File, existingId?: string) => Promise<void>;
  onRemoveMedia: (id: string, index: number) => void | Promise<void>;
  onMoveMedia: (id: string, offset: -1 | 1) => void;
  onSetPrimaryMedia: (id: string) => void;
  skuStagedMedia: MediaDraft[];
  onStageSkuMedia: (file: File, skuEditorId: string, replaceAssetRef?: string, retryId?: string) => Promise<void>;
  onRemoveSkuMedia: (skuEditorId: string, assetRef: string) => Promise<void>;
  onRemoveSkuStagedMedia: (id: string) => void;
  onOpenConfig: (library: CatalogLibraryKind, focusTestId: string) => void;
  basicDraft: CatalogEditorDraftSlice<CatalogItemBasicDraft>;
  productionDraft: CatalogEditorDraftSlice<CatalogItemProductionDraft>;
  attributeAssignmentsDraft: CatalogAttributeAssignment[];
  onAttributeAssignmentsChange: (next: CatalogAttributeAssignment[]) => void;
  orderOptionConfigsDraft: CatalogOrderOptionConfig[];
  onOrderOptionConfigsChange: (next: CatalogOrderOptionConfig[]) => void;
  identifierDraft: CatalogIdentifierDraft[];
  createDraftRowId: (prefix: string) => string;
  inventoryRulesDraft: CatalogInventoryRuleNode[];
  compositeGroupsDraft: CatalogCompositeGroupDraft[];
  skuVariantDimensionsDraft: SkuDimensionDraft[];
  skusDraft: SkuRowDraft[];
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  currentItemCode?: string;
  onIdentifiersChange: (next: CatalogIdentifierDraft[]) => void;
  onInventoryRulesChange: (next: CatalogInventoryRuleNode[]) => void;
  onCompositeGroupsChange: (next: CatalogCompositeGroupDraft[]) => void;
  onSkuVariantDimensionsChange: (next: SkuDimensionDraft[]) => void;
  onSkusChange: (next: CatalogSkuRow[]) => void;
  onDirty: () => void;
  onVoidSku?: (sku: CatalogSkuRow) => void;
  voidingSkuRef?: string;
  onNavigateTab: (tabKey: string) => void;
};
