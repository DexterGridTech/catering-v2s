import type {
  InventoryAvailabilityFact,
  ManualSaleStatusFact,
  SalesMenuDraftItemView,
} from '../../../app/api/generated/operations-edge';

export type {InventoryAvailabilityFact, ManualSaleStatusFact, SalesMenuDraftItemView};
export type SalesMenuProductShape = SalesMenuDraftItemView['productShape'];
