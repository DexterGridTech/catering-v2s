import type {StockView} from './ui/inventoryManagementModel';

export type InventoryActionDirection = 'INCREASE' | 'DECREASE';

export const inventoryActionResultCloseTestId = 'inventory-action-result-close';
export const inventoryZoneDiagnosticsTestId = 'inventory-zone-diagnostics';

export function inventoryStockViewTestId(view: StockView): string {
  return `inventory-stock-view-option-${view.toLowerCase()}`;
}

export function inventoryActionDirectionTestId(direction: InventoryActionDirection): string {
  return `inventory-action-direction-option-${direction.toLowerCase()}`;
}
