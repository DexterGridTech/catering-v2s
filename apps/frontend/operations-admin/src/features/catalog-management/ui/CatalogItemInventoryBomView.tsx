import type {CatalogDetail} from '../model/catalogModel';
import {CatalogInventoryBomView} from './CatalogInventoryBomView';
import {CatalogFactSectionView} from './CatalogFactSectionBoundary';

export function CatalogItemInventoryBomView({detail}: {detail: NonNullable<CatalogDetail>}) {
  return (
    <CatalogFactSectionView section="inventory-bom">
      <CatalogInventoryBomView
        detail={detail}
        nodes={detail.inventoryRules.nodes}
        baseUnitForOwner={node =>
          node.owner.ownerType === 'ITEM'
            ? detail.item.baseMeasureUnit
            : node.owner.ownerType === 'SKU'
              ? (detail.item.skus.find(sku => sku.productSkuRef === node.owner.productSkuRef)?.baseMeasureUnit ?? null)
              : null
        }
      />
    </CatalogFactSectionView>
  );
}
